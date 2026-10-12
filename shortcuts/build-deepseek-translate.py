#!/usr/bin/env python3
"""构建「DeepSeek 翻译」快捷指令（.shortcut）。

用法:
    python3 shortcuts/build-deepseek-translate.py            # 生成未签名文件
    python3 shortcuts/build-deepseek-translate.py --sign     # 生成并调用 shortcuts sign 签名

说明:
    生成结果里最上面几个文本动作即为可配置项（API Key / 接口地址 / 模型），
    也可以在这里改完常量后重新运行本脚本生成新的 .shortcut 文件。
    签名后的文件在 iOS/macOS 上双击即可导入（iOS 需在设置中允许「不受信任的快捷指令」）。
"""

from __future__ import annotations

import argparse
import plistlib
import subprocess
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent
UNSIGNED = ROOT / "deepseek-translate.unsigned.shortcut"
SIGNED = ROOT / "deepseek-translate.shortcut"

SHORTCUT_NAME = "DeepSeek 翻译"
# 图标: globe（官方同义词中对应 translate）+ Navy
ICON_GLYPH = 59412
ICON_COLOR = 946986751

# ---------------------------------------------------------------------------
# 需要用户填写 / 按需修改的配置（生成后也是快捷指令里最上面的几个文本动作）
# ---------------------------------------------------------------------------
DEFAULT_API_KEY = "sk-在这里填入你的DeepSeek-API-Key"
DEFAULT_API_URL = "https://api.deepseek.com/chat/completions"
DEFAULT_MODEL = "deepseek-chat"

SYSTEM_PROMPT = (
    "你是专业翻译。如果输入内容主要是中文，就翻译成地道自然的英文；"
    "如果主要是英文或其他语言，就翻译成简体中文。"
    "只输出译文本身，不要解释、不要加引号、不要保留原文、不要添加任何前后缀，保留原文语气。"
)

# 用户输入会嵌入 JSON 字符串中，提交前需要先做转义，避免引号 / 反斜杠 / 换行破坏 JSON。
JSON_BODY_TEMPLATE = """{
  "model": "{{model}}",
  "messages": [
    {
      "role": "system",
      "content": "%s"
    },
    {
      "role": "user",
      "content": "{{text}}"
    }
  ],
  "temperature": 1.3,
  "stream": false
}""" % SYSTEM_PROMPT


# ---------------------------------------------------------------------------
# 序列化辅助
# ---------------------------------------------------------------------------
def new_id() -> str:
    return str(uuid.uuid4()).upper()


def text_token(template: str, variables: dict[str, dict] | None = None) -> dict:
    """把 {{name}} 占位符替换成变量附件，并计算 attachmentsByRange。"""
    variables = variables or {}
    out = ""
    attachments: dict[str, dict] = {}
    i = 0
    while i < len(template):
        if template.startswith("{{", i):
            end = template.index("}}", i)
            name = template[i + 2:end]
            if name not in variables:
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


def field_key(name: str) -> dict:
    return {"Value": {"string": name}, "WFSerializationType": "WFTextTokenString"}


def dict_field(items: list[dict]) -> dict:
    """WFDictionaryFieldValue（请求头等字典参数的序列化形式）。"""
    return {
        "Value": {"WFDictionaryFieldValueItems": items},
        "WFSerializationType": "WFDictionaryFieldValue",
    }


def text_field(name: str, wf_value: dict, item_type: int = 0) -> dict:
    return {"WFItemType": item_type, "WFKey": field_key(name), "WFValue": wf_value}


def output_ref(action_id: str, name: str) -> dict:
    return {"OutputUUID": action_id, "OutputName": name, "Type": "ActionOutput"}


def action(identifier: str, **params) -> dict:
    return {
        "WFWorkflowActionIdentifier": identifier,
        "WFWorkflowActionParameters": params,
    }


def comment(body: str) -> dict:
    return action("is.workflow.actions.comment", WFCommentActionText=body)


def text_action(body: str | dict, action_id: str, output_name: str | None = None) -> dict:
    params: dict = {"UUID": action_id, "WFTextActionText": body}
    if output_name:
        params["CustomOutputName"] = output_name
    return action("is.workflow.actions.gettext", **params)


def get_value(action_id: str, key: str, source: dict, output_name: str | None = None) -> dict:
    params: dict = {"UUID": action_id, "WFDictionaryKey": key, "WFInput": source}
    if output_name:
        params["CustomOutputName"] = output_name
    return action("is.workflow.actions.getvalueforkey", **params)


# ---------------------------------------------------------------------------
# 动作定义
# ---------------------------------------------------------------------------
def build_actions() -> list[dict]:
    key_id, url_id, model_id = new_id(), new_id(), new_id()
    ask_id = new_id()
    escape_nl, escape_bs, escape_quote = new_id(), new_id(), new_id()
    body_id, request_id = new_id(), new_id()
    choices_id, first_id, message_id, content_id = new_id(), new_id(), new_id(), new_id()
    if_group = new_id()

    actions: list[dict] = []

    actions.append(comment(
        "DeepSeek 中英互译：运行后输入要翻译的文字，中文译成英文，英文译成中文。\n"
        "首次使用请在下面「API Key」文本里填入自己的密钥"
        "（https://platform.deepseek.com/api_keys）。"
        "接口地址与模型默认使用 DeepSeek，换成其它 OpenAI 兼容服务时一并修改即可。"
    ))

    actions.append(text_action(DEFAULT_API_KEY, key_id, "API Key"))
    actions.append(text_action(DEFAULT_API_URL, url_id, "接口地址"))
    actions.append(text_action(DEFAULT_MODEL, model_id, "模型"))

    actions.append(action(
        "is.workflow.actions.ask",
        UUID=ask_id,
        WFAskActionPrompt="输入要翻译的文字",
        WFInputType="Text",
    ))

    actions.append(comment(
        "转义用户输入：换行折成空格、反斜杠和引号转义，避免破坏后面拼接的 JSON。"
    ))

    actions.append(action(
        "is.workflow.actions.text.replace",
        UUID=escape_nl,
        WFInput=text_token("{{input}}", {"input": output_ref(ask_id, "Provided Input")}),
        WFReplaceTextFind="[\\r\\n]+",
        WFReplaceTextReplace=" ",
        WFReplaceTextRegularExpression=True,
    ))
    actions.append(action(
        "is.workflow.actions.text.replace",
        UUID=escape_bs,
        WFInput=text_token("{{escaped}}", {"escaped": output_ref(escape_nl, "Updated Text")}),
        WFReplaceTextFind="\\",
        WFReplaceTextReplace="\\\\",
        WFReplaceTextRegularExpression=False,
    ))
    actions.append(action(
        "is.workflow.actions.text.replace",
        UUID=escape_quote,
        WFInput=text_token("{{escaped}}", {"escaped": output_ref(escape_bs, "Updated Text")}),
        WFReplaceTextFind='"',
        WFReplaceTextReplace='\\"',
        WFReplaceTextRegularExpression=False,
    ))

    actions.append(text_action(
        text_token(JSON_BODY_TEMPLATE, {
            "model": output_ref(model_id, "模型"),
            "text": output_ref(escape_quote, "Updated Text"),
        }),
        body_id,
        "请求体",
    ))

    actions.append(comment("调用大模型接口（请求体走 File 方式提交，避免嵌套 JSON 在编辑器里被改写）。"))

    actions.append(action(
        "is.workflow.actions.downloadurl",
        UUID=request_id,
        CustomOutputName="响应",
        WFURL=text_token("{{url}}", {"url": output_ref(url_id, "接口地址")}),
        WFHTTPMethod="POST",
        WFHTTPBodyType="File",
        WFRequestVariable=text_token("{{body}}", {"body": output_ref(body_id, "请求体")}),
        WFFormValues=dict_field([]),
        WFHTTPHeaders=dict_field([
            text_field("Authorization", text_token(
                "Bearer {{key}}", {"key": output_ref(key_id, "API Key")})),
            text_field("Content-Type", text_token("application/json")),
        ]),
        Advanced=True,
        ShowHeaders=True,
    ))

    response = attachment(output_ref(request_id, "响应"))
    actions.append(get_value(choices_id, "choices", response, "候选列表"))
    actions.append(action(
        "is.workflow.actions.getitemfromlist",
        UUID=first_id,
        CustomOutputName="首个候选",
        WFInput=attachment(output_ref(choices_id, "候选列表")),
    ))
    actions.append(get_value(message_id, "message",
                             attachment(output_ref(first_id, "首个候选")), "消息对象"))
    actions.append(get_value(content_id, "content",
                             attachment(output_ref(message_id, "消息对象")), "译文"))

    actions.append(comment("取不到译文时提示排查，正常情况下直接展示译文。"))

    actions.append(action(
        "is.workflow.actions.conditional",
        GroupingIdentifier=if_group,
        WFControlFlowMode=0,
        WFCondition=101,  # 没有值
        WFInput={
            "Type": "Variable",
            "Variable": attachment(output_ref(content_id, "译文")),
        },
    ))
    actions.append(action(
        "is.workflow.actions.alert",
        WFAlertActionTitle="翻译失败",
        WFAlertActionMessage=text_token(
            "没有拿到译文，请检查网络或 API Key 是否正确。\n\n接口返回：{{response}}",
            {"response": output_ref(request_id, "响应")},
        ),
        WFAlertActionCancelButtonShown=False,
    ))
    actions.append(action(
        "is.workflow.actions.conditional",
        GroupingIdentifier=if_group,
        WFControlFlowMode=1,
    ))
    actions.append(action(
        "is.workflow.actions.showresult",
        Text=text_token("{{result}}", {"result": output_ref(content_id, "译文")}),
    ))
    actions.append(action(
        "is.workflow.actions.conditional",
        GroupingIdentifier=if_group,
        WFControlFlowMode=2,
    ))

    return actions


def build_shortcut() -> dict:
    return {
        "WFWorkflowActions": build_actions(),
        "WFWorkflowClientVersion": "2700.0.4",
        "WFWorkflowHasOutputFallback": False,
        "WFWorkflowIcon": {
            "WFWorkflowIconGlyphNumber": ICON_GLYPH,
            "WFWorkflowIconStartColor": ICON_COLOR,
        },
        "WFWorkflowImportQuestions": [],
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
    args = parser.parse_args()

    with UNSIGNED.open("wb") as fp:
        plistlib.dump(build_shortcut(), fp)
    print(f"已生成 {UNSIGNED.relative_to(ROOT.parent)}")

    if not args.sign:
        return 0

    if sys.platform != "darwin":
        print("非 macOS 环境，跳过签名", file=sys.stderr)
        return 1

    result = subprocess.run(
        ["shortcuts", "sign", "--mode", "anyone", "--input", str(UNSIGNED), "--output", str(SIGNED)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print(result.stdout, result.stderr, file=sys.stderr)
        return result.returncode

    print(f"已生成签名文件 {SIGNED.relative_to(ROOT.parent)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
