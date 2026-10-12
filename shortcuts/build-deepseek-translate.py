#!/usr/bin/env python3
"""构建「DeepSeek 翻译」快捷指令（.shortcut）。

用法:
    python3 shortcuts/build-deepseek-translate.py                      # 生成占位符版本（可提交仓库）
    python3 shortcuts/build-deepseek-translate.py --sign               # 生成并调用 shortcuts sign 签名
    python3 shortcuts/build-deepseek-translate.py --sign --api-key sk-xxx

说明:
    导入快捷指令时会直接询问 API Key / 接口地址 / 模型，默认值即 DeepSeek，可以当场改成其它
    OpenAI 兼容服务；导入后在快捷指令里也能随时修改这三个文本动作，或改这里再重新生成。

    API Key 与接口 / 模型等配置统一放在 shortcuts/.env（已 gitignore，首次运行自动生成模板）。
    取用顺序: --api-key > 环境变量 DEEPSEEK_API_KEY > shortcuts/.env > 内置默认值。
    只要取到了真实 Key，产物会写成 *.local.shortcut，以免密钥被误提交。

实现要点（踩过的坑，改动前先看这里）:
    1. 请求体必须用 WFHTTPBodyType=JSON + WFJSONValues 的结构化写法。
       WFHTTPBodyType=File + WFRequestVariable 在 macOS 27 上不会带上请求体（Content-Length: 0）。
    2. 结构化 JSON 由系统序列化，引号 / 换行 / 反斜杠会自动转义，所以不需要额外的文本替换动作。
    3. 数字项要写成 WFItemType=3 + WFTextTokenString（写 WFNumberSubstitutableState 会被当成 0）。
    4. 布尔项写 WFItemType=4 + WFBooleanSubstitutableState。
    5. 服务端返回非 JSON（例如网关的文本错误页）时，「获取字典值」会硬报错，
       所以先用 If「响应包含 choices」兜一层，失败就展示原始响应，而不是抛出晦涩的错误。
"""

from __future__ import annotations

import argparse
import itertools
import os
import plistlib
import subprocess
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT / ".env"
SHORTCUT_NAME = "Fan-DeepSeek 翻译"
_ID_SEQ = itertools.count(1)
UNSIGNED = ROOT / f"{SHORTCUT_NAME}.unsigned.shortcut"
SIGNED = ROOT / f"{SHORTCUT_NAME}.shortcut"
VERSION = "0.0.1"
RELEASED = "2026-10-12"
# 图标: globe（官方同义词中对应 translate）+ Navy
ICON_GLYPH = 59412
ICON_COLOR = 946986751

# ---------------------------------------------------------------------------
# 需要用户填写 / 按需修改的配置（生成后也是快捷指令里最上面的三个文本动作）
# ---------------------------------------------------------------------------
DEFAULT_API_KEY = "sk-在这里填入你的DeepSeek-API-Key"
DEFAULT_API_URL = "https://api.deepseek.com/chat/completions"
DEFAULT_MODEL = "deepseek-chat"
TEMPERATURE = "1.3"

# shortcuts/.env 模板：该文件不入库，密钥只留在本地
ENV_TEMPLATE = """\
# 生成快捷指令时读取的配置（本文件已在 .gitignore 中，只留在本地）
# 填好后运行：python3 shortcuts/build-deepseek-translate.py --sign
# 产物 Fan-DeepSeek 翻译.local.shortcut 已把 Key 写进快捷指令，导入时不用再填。
# 修改本文件后重新生成 + 重新导入，即可更新本地那份快捷指令。

# 运行快捷指令前要填上，获取地址 https://platform.deepseek.com/api_keys
API_KEY=

# 下面三项默认走 DeepSeek，换成其它 OpenAI 兼容服务时一起改
API_URL=https://api.deepseek.com/chat/completions
MODEL=deepseek-chat
# 0~2，越小越稳定
TEMPERATURE=1.3
"""

SYSTEM_PROMPT = (
    "你是专业翻译。如果输入内容主要是中文，就翻译成地道自然的英文；"
    "如果主要是英文或其他语言，就翻译成简体中文。"
    "只输出译文本身，不要解释、不要加引号、不要保留原文、不要添加任何前后缀，保留原文语气。"
)


# ---------------------------------------------------------------------------
# 序列化辅助
# ---------------------------------------------------------------------------
def new_id() -> str:
    """稳定生成动作 UUID：配置没变时重复生成得到逐字节一致的产物。"""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"{SHORTCUT_NAME}-{next(_ID_SEQ)}")).upper()


def text_token(template: str = "", variables: dict[str, dict] | None = None) -> dict:
    """WFTextTokenString：把 {{name}} 占位符替换成变量附件，并计算 attachmentsByRange。"""
    out = ""
    attachments: dict[str, dict] = {}
    i = 0
    while i < len(template):
        if template.startswith("{{", i):
            end = template.index("}}", i)
            name = template[i + 2:end]
            if name not in (variables or {}):
                raise KeyError(f"未定义的占位符: {name}")
            # attachmentsByRange 使用 UTF-16 单元的 NSRange
            position = len(out.encode("utf-16-le")) // 2
            attachments[f"{{{position}, 1}}"] = variables[name]
            out += "\ufffc"
            i = end + 2
        else:
            out += template[i]
            i += 1

    value: dict = {"string": out}
    if attachments:
        value["attachmentsByRange"] = attachments
    return {"Value": value, "WFSerializationType": "WFTextTokenString"}


def attachment(ref: dict) -> dict:
    return {"Value": ref, "WFSerializationType": "WFTextTokenAttachment"}


def output_ref(action_id: str, name: str) -> dict:
    return {"OutputUUID": action_id, "OutputName": name, "Type": "ActionOutput"}


def field_key(name: str) -> dict:
    return text_token(name)


def dict_field(items: list[dict]) -> dict:
    """WFDictionaryFieldValue（请求头等字典参数）。"""
    return {
        "Value": {"WFDictionaryFieldValueItems": items},
        "WFSerializationType": "WFDictionaryFieldValue",
    }


def nested_dict_value(items: list[dict]) -> dict:
    """WFJSONValues 里的嵌套字典（比顶层多一层 Value）。"""
    return {
        "Value": {
            "Value": {"WFDictionaryFieldValueItems": items},
            "WFSerializationType": "WFDictionaryFieldValue",
        },
        "WFSerializationType": "WFDictionaryFieldValue",
    }


def text_field(name: str, value: dict) -> dict:
    return {"WFItemType": 0, "WFKey": field_key(name), "WFValue": value}


def json_item(key: str, item_type: int, value: dict) -> dict:
    return {"WFItemType": item_type, "WFKey": field_key(key), "WFValue": value}


def json_text(key: str, value) -> dict:
    """字符串项：可以传字面量、变量引用（output_ref）或已经包好的 WFTextTokenString。"""
    if isinstance(value, dict) and "WFSerializationType" in value:
        token = value                      # 已经是序列化好的 token
    elif isinstance(value, dict):
        token = text_token("{{v}}", {"v": value})   # 变量引用
    else:
        token = text_token(str(value))
    return json_item(key, 0, token)


def json_number(key: str, value: str) -> dict:
    """数字必须用文本 token，写成 WFNumberSubstitutableState 会在运行时变成 0。"""
    return json_item(key, 3, text_token(value))


def json_bool(key: str, value: bool) -> dict:
    return json_item(key, 4, {"Value": value, "WFSerializationType": "WFBooleanSubstitutableState"})


def json_dict(key: str, items: list[dict]) -> dict:
    return json_item(key, 1, nested_dict_value(items))


def json_array(key: str, elements: list[dict]) -> dict:
    return json_item(key, 2, {"Value": elements, "WFSerializationType": "WFArrayParameterState"})


def action(identifier: str, **params) -> dict:
    return {
        "WFWorkflowActionIdentifier": identifier,
        "WFWorkflowActionParameters": params,
    }


def comment(body: str) -> dict:
    return action("is.workflow.actions.comment", WFCommentActionText=body)


def text_action(body, action_id: str, output_name: str | None = None) -> dict:
    params: dict = {"UUID": action_id, "WFTextActionText": body}
    if output_name:
        params["CustomOutputName"] = output_name
    return action("is.workflow.actions.gettext", **params)


def get_value(action_id: str, key: str, source_id: str, source_name: str, output_name: str) -> dict:
    return action(
        "is.workflow.actions.getvalueforkey",
        UUID=action_id,
        CustomOutputName=output_name,
        WFDictionaryKey=key,
        WFInput=attachment(output_ref(source_id, source_name)),
    )


def conditional(group: str, mode: int, **params) -> dict:
    return action(
        "is.workflow.actions.conditional",
        GroupingIdentifier=group,
        WFControlFlowMode=mode,
        **params,
    )


# ---------------------------------------------------------------------------
# 动作定义
# ---------------------------------------------------------------------------
def build_actions(config: dict[str, str]) -> list[dict]:
    key_id, url_id, model_id, ask_id = new_id(), new_id(), new_id(), new_id()
    request_id = new_id()
    choices_id, first_id, message_id, content_id = new_id(), new_id(), new_id(), new_id()
    group = new_id()

    response = lambda: attachment(output_ref(request_id, "响应"))  # noqa: E731

    actions: list[dict] = [
        comment(
            f"{SHORTCUT_NAME} v{VERSION}（{RELEASED}）\n"
            "运行后输入要翻译的文字：中文译成英文，英文译成中文。\n"
            "首次使用请把下面「API Key」文本换成自己的密钥"
            "（https://platform.deepseek.com/api_keys）。"
            "接口地址与模型默认使用 DeepSeek，换成其它 OpenAI 兼容服务时一并修改即可。"
        ),
        text_action(config["api_key"], key_id, "API Key"),
        text_action(config["api_url"], url_id, "接口地址"),
        text_action(config["model"], model_id, "模型"),
        action(
            "is.workflow.actions.ask",
            UUID=ask_id,
            WFAskActionPrompt="输入要翻译的文字",
            WFInputType="Text",
        ),
        # 请求体交给系统序列化，引号 / 换行等会自动转义，无需手工替换
        action(
            "is.workflow.actions.downloadurl",
            UUID=request_id,
            CustomOutputName="响应",
            WFURL=text_token("{{url}}", {"url": output_ref(url_id, "接口地址")}),
            WFHTTPMethod="POST",
            WFHTTPBodyType="JSON",
            WFJSONValues=dict_field([
                json_text("model", output_ref(model_id, "模型")),
                json_number("temperature", config["temperature"]),
                json_bool("stream", False),
                json_array("messages", [
                    {"WFItemType": 1, "WFValue": nested_dict_value([
                        json_text("role", "system"),
                        json_text("content", SYSTEM_PROMPT),
                    ])},
                    {"WFItemType": 1, "WFValue": nested_dict_value([
                        json_text("role", "user"),
                        json_text("content", output_ref(ask_id, "Provided Input")),
                    ])},
                ]),
            ]),
            WFHTTPHeaders=dict_field([
                text_field("Authorization", text_token(
                    "Bearer {{key}}", {"key": output_ref(key_id, "API Key")})),
                text_field("Content-Type", text_token("application/json")),
            ]),
            Advanced=True,
            ShowHeaders=True,
        ),
        # 服务端没返回 JSON（网关文本错误页等）时直接跳过解析，避免「无法将文本转换为字典」
        comment("响应里没有 choices 就说明调用失败，直接把原始响应展示出来，方便排查。"),
        conditional(
            group, 0,
            WFCondition=99,  # 包含
            WFConditionalActionString="choices",
            WFInput={"Type": "Variable", "Variable": response()},
        ),
        get_value(choices_id, "choices", request_id, "响应", "候选列表"),
        action(
            "is.workflow.actions.getitemfromlist",
            UUID=first_id,
            CustomOutputName="首个候选",
            WFInput=attachment(output_ref(choices_id, "候选列表")),
        ),
        get_value(message_id, "message", first_id, "首个候选", "消息对象"),
        get_value(content_id, "content", message_id, "消息对象", "译文"),
        action(
            "is.workflow.actions.showresult",
            Text=text_token("{{result}}", {"result": output_ref(content_id, "译文")}),
        ),
        conditional(group, 1),
        action(
            "is.workflow.actions.alert",
            WFAlertActionTitle="翻译失败",
            WFAlertActionMessage=text_token(
                "没有拿到译文，请检查网络、API Key 或接口地址。\n\n接口返回：{{response}}",
                {"response": response()},
            ),
            WFAlertActionCancelButtonShown=False,
        ),
        conditional(group, 2),
    ]
    return actions


def load_env() -> dict[str, str]:
    """读取 shortcuts/.env（不存在则生成一份模板），返回大写键名的配置字典。"""
    if not ENV_FILE.exists():
        ENV_FILE.write_text(ENV_TEMPLATE, encoding="utf-8")
        print(f"已生成配置模板 {ENV_FILE.relative_to(ROOT.parent)}，填好 API_KEY 后再运行一次")

    config: dict[str, str] = {}
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        value = value.strip().strip('"').strip("'")
        if value:
            config[name.strip().upper()] = value
    return config


def resolve_config(cli_key: str | None) -> dict[str, str]:
    """优先级：--api-key > 环境变量 DEEPSEEK_API_KEY > shortcuts/.env > 内置默认值。"""
    env = load_env()
    api_key = cli_key or os.environ.get("DEEPSEEK_API_KEY") or env.get("API_KEY", "")
    return {
        "api_key": api_key.strip() or DEFAULT_API_KEY,
        "api_url": env.get("API_URL", DEFAULT_API_URL),
        "model": env.get("MODEL", DEFAULT_MODEL),
        "temperature": env.get("TEMPERATURE", TEMPERATURE),
    }


def build_shortcut(config: dict[str, str]) -> dict:
    actions = build_actions(config)

    # 导入时直接询问三个配置项，默认值即 DeepSeek；确认后仍可在快捷指令里随时修改。
    config = {
        "API Key": "DeepSeek API Key（留空可稍后在快捷指令里填写）",
        "接口地址": "接口地址（任意 OpenAI 兼容服务）",
        "模型": "模型名称",
    }
    questions = []
    for index, item in enumerate(actions):
        name = item["WFWorkflowActionParameters"].get("CustomOutputName")
        if name in config:
            questions.append({
                "ActionIndex": index,
                "ParameterKey": "WFTextActionText",
                "Text": config[name],
                "DefaultValue": item["WFWorkflowActionParameters"]["WFTextActionText"],
            })

    return {
        "WFWorkflowActions": actions,
        "WFWorkflowClientVersion": "2700.0.4",
        "WFWorkflowHasOutputFallback": False,
        "WFWorkflowIcon": {
            "WFWorkflowIconGlyphNumber": ICON_GLYPH,
            "WFWorkflowIconStartColor": ICON_COLOR,
        },
        "WFWorkflowImportQuestions": questions,
        "WFWorkflowInputContentItemClasses": [],
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowName": SHORTCUT_NAME,
        "WFWorkflowOutputContentItemClasses": [],
        "WFWorkflowTypes": [],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="生成 DeepSeek 翻译快捷指令")
    parser.add_argument("--sign", action="store_true", help="调用 shortcuts sign 输出可导入的签名文件")
    parser.add_argument("--api-key", help="DeepSeek API Key，会输出到不提交仓库的 *.local.shortcut")
    args = parser.parse_args()

    config = resolve_config(args.api_key)
    has_real_key = config["api_key"] != DEFAULT_API_KEY
    if has_real_key:
        unsigned_path = ROOT / f"{SHORTCUT_NAME}.local.unsigned.shortcut"
        signed_path = ROOT / f"{SHORTCUT_NAME}.local.shortcut"
    else:
        unsigned_path, signed_path = UNSIGNED, SIGNED

    with unsigned_path.open("wb") as fp:
        plistlib.dump(build_shortcut(config), fp)
    print(f"已生成 {unsigned_path.relative_to(ROOT.parent)}")
    if has_real_key:
        print("  ↑ 含真实 API Key，已在 .gitignore 中忽略，请勿提交")
        print(f"  导入 {signed_path.relative_to(ROOT.parent)} 即可，配置已内置，导入时不用再填")
    else:
        print(f"  ↑ 还没有 API Key：把 Key 写进 {ENV_FILE.relative_to(ROOT.parent)} 后重新运行即可")

    if not args.sign:
        return 0

    if sys.platform != "darwin":
        print("非 macOS 环境，跳过签名", file=sys.stderr)
        return 1

    result = subprocess.run(
        ["shortcuts", "sign", "--mode", "anyone", "--input", str(unsigned_path),
         "--output", str(signed_path)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stdout, result.stderr, file=sys.stderr)
        return result.returncode

    print(f"已生成签名文件 {signed_path.relative_to(ROOT.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
