import type { MessageKey } from "./en.js";

// 한국어 메시지. en.ts 와 키가 정확히 같아야 한다.
export const ko: Record<MessageKey, string> = {
  "help.text": `hookparity {version} - 에이전트 훅을 나란히 미리 보고, 실행하고, 테스트하고, 점검합니다

사용법:
  hookparity list  [--dir .] [--user | --home <디렉터리>] [--agents claude,codex,gemini,antigravity] [--json]
  hookparity match --tool <도구> [--input '<json>'] [--dir .] [--json]
  hookparity run   --tool <도구> [--input '<json>'] [--dir .] [--max-timeout 30] [--fail-on-divergence] [--json]
  hookparity test  <cases.json...> [--dir .] [--max-timeout 30] [--json]
  hookparity lint  [--dir .] [--strict] [--json]

명령:
  list    프로젝트(와 사용자) 설정에서 찾은 모든 훅을 보여 줍니다. 시간 제한은 초 단위.
  match   가상 도구 호출 하나에 어떤 훅이 걸리는지 보여 줍니다. 아무것도 실행하지 않습니다.
  run     걸리는 훅을 에이전트별 stdin 으로 실행하고 판정을 비교합니다.
  test    케이스 파일의 기대값을 검사합니다(CI 회귀). 어긋나면 종료 코드 1.
  lint    에이전트 사이의 정적 점검(HP001-HP009). 아무것도 실행하지 않습니다.

도구: shell, edit, write, read, mcp:<서버>/<도구>, Claude 이름(Bash, Edit, mcp__s__t),
      또는 gemini:run_shell_command 처럼 <에이전트>:<고유 이름>.

옵션:
  --dir <경로>            프로젝트 디렉터리(기본: 현재 디렉터리)
  --user                  홈 디렉터리의 사용자 설정도 읽습니다(읽기 전용)
  --home <디렉터리>       --user 와 같고 다른 홈 디렉터리를 지정합니다(테스트용)
  --agents <목록>         claude,codex,gemini,antigravity 를 쉼표로(antigravity 는 실험적)
  --tool <도구>           가상 도구 호출(위 참고)
  --input <json>          도구 입력을 JSON 객체로(기본: {})
  --max-timeout <초>      실행할 때 더 긴 훅 시간 제한을 줄입니다(기본: 30)
  --fail-on-divergence    run: 에이전트 판정이 갈리면 종료 코드 1
  --strict                lint: 경고도 종료 코드 1
  --json                  기계가 읽는 출력
  --lang <en|ko>          출력 언어(또는 HOOKPARITY_LANG, 그다음 LC_ALL / LC_MESSAGES / LANG)
  --version, --help

종료 코드: 0 정상, 1 불일치 / 린트 오류 / 판정 갈림, 2 사용법·설정 오류.
"run" 과 "test" 는 훅 명령을 실제로 실행합니다. 믿지 못하는 저장소에서는 "match" 와 "lint" 만 쓰세요.
`,

  "col.agent": "에이전트",
  "col.event": "이벤트",
  "col.matcher": "매처",
  "col.type": "형식",
  "col.command": "명령",
  "col.timeout": "시간 제한(초)",
  "col.if": "if",
  "col.source": "출처",
  "col.how": "일치 방식",
  "col.tool": "도구",
  "col.verdict": "판정",
  "col.hooks": "훅",
  "col.findings": "발견",
  "col.severity": "심각도",
  "col.id": "ID",
  "col.message": "메시지",

  "verdict.allow": "허용",
  "verdict.block": "차단",
  "verdict.ask": "확인",
  "verdict.skip": "해당 없음",

  "matchKind.all": "전부",
  "matchKind.exact": "정확 일치 이름 목록",
  "matchKind.regex": "정규식(고정 안 됨)",
  "matchKind.invalid": "잘못된 정규식",

  "if.none": "-",
  "if.true": "참",
  "if.false": "거짓(건너뜀)",
  "if.ignored": "이 에이전트는 무시",
  "if.never-runs": "실행 안 됨(도구 이벤트 아님)",

  "agent.experimental": "실험적",
  "list.none": "{dir} 에서 훅을 찾지 못했습니다.",
  "list.count": "훅 {count}개를 찾았습니다.",
  "list.user": "사용자 설정을 {home} 에서 읽었습니다(읽기 전용).",
  "match.header": "{agent} ({tool}): 훅 {count}개가 걸림",
  "match.noTool": "{agent}: 이 호출에 대응하는 도구가 없어 건너뜀",
  "match.filtered": "이름은 일치했지만 if 규칙에 걸러진 훅이 {count}개 더 있습니다.",
  "match.notRunnable": "{type} 핸들러: 목록에만 표시, 실행 안 함",
  "match.none": "확인할 에이전트가 없습니다. 훅 설정을 추가하거나 --agents 를 지정하세요.",
  "run.plan": "설정에서 찾은 훅 명령 {count}개를 실행합니다:",
  "run.planNone": "이 호출에 걸리는 훅 명령이 없어 아무것도 실행하지 않습니다.",
  "run.divergent": "에이전트마다 판정이 다릅니다: {verdicts}",
  "run.same": "모든 에이전트가 같은 판정입니다: {verdict}",
  "run.capped": "{sec}초로 줄임",
  "run.hookLine": "{agent}: {command} -> 종료 {code}, {ms}밀리초, {decision}",
  "run.hookLineTimeout": "{agent}: {command} -> {sec}초 뒤 시간 초과, {ms}밀리초, {decision}",
  "test.ok": "통과  {name}",
  "test.fail": "실패  {name}",
  "test.mismatch": "      {agent}: 기대 {expected}, 실제 {got}",
  "test.summary": "케이스 {passed}/{total}개 통과, 불일치 {mismatches}건.",
  "severity.error": "오류",
  "severity.warn": "경고",
  "severity.info": "정보",
  "lint.none": "발견된 문제가 없습니다.",
  "lint.summary": "발견 {total}건: 오류 {errors}, 경고 {warns}, 정보 {infos}.",

  "error.config": "{file} 을(를) 읽을 수 없습니다: {detail}",
  "config.notFound": "파일이 없습니다.",
  "config.unreadable": "파일을 열 수 없습니다({code}).",
  "config.syntax": "올바른 JSON / TOML 이 아닙니다.",
  "config.syntaxAt": "{line}행 {column}열에 문법 오류가 있습니다.",
  "config.syntaxEnd": "JSON 이 끝나기 전에 파일이 끝났습니다(] 나 } 가 빠졌나요?).",
  "config.syntaxToken": "JSON 에 예상하지 못한 문자가 있습니다: '{token}'.",
  "config.notObject": "최상위는 객체(JSON) 또는 테이블(TOML)이어야 합니다.",
  "cases.notObject": "최상위는 {\"cases\": [...]} 같은 객체여야 합니다.",
  "cases.empty": "\"cases\" 는 비어 있지 않은 배열이어야 합니다.",
  "cases.itemNotObject": "`{at}` 은(는) 객체여야 합니다.",
  "cases.needString": "`{field}` 은(는) 비어 있지 않은 문자열이어야 합니다.",
  "cases.inputNotObject": "`{at}.input` 은(는) 객체여야 합니다.",
  "cases.expectMissing": "`{at}.expect` 은(는) {\"*\": \"block\"} 같은 객체여야 합니다.",
  "cases.unknownAgent": "`{at}.expect` 에 알 수 없는 에이전트가 있습니다: \"{agent}\". 사용 가능: {allowed}.",
  "cases.badDecision": "`{field}` 값은 다음 중 하나여야 합니다: {allowed}.",
  "error.unknownTool": "알 수 없는 도구 \"{tool}\". shell, edit, write, read, mcp:<서버>/<도구>, Bash 같은 Claude 이름, 또는 <에이전트>:<이름> 을 쓰세요.",
  "error.missingTool": "--tool 이 필요합니다. 예: --tool shell",
  "error.inputNotJson": "--input 이 올바른 JSON 이 아닙니다. 예: --input '{\"command\":\"ls\"}'",
  "error.inputNotObject": "--input 은 JSON 객체여야 합니다. 예: {\"command\":\"ls\"}",
  "error.badLang": "--lang 은 en 또는 ko 여야 합니다(받은 값: \"{value}\").",
  "error.badAgents": "--agents 에 알 수 없는 에이전트가 있습니다: \"{value}\". 사용 가능: {allowed}.",
  "error.badNumber": "--max-timeout 은 0보다 큰 초 단위 숫자여야 합니다(받은 값: \"{value}\").",
  "error.unknownCommand": "알 수 없는 명령 \"{command}\". 'hookparity --help' 를 실행해 보세요.",
  "error.unknownOption": "알 수 없는 옵션 {option}. 'hookparity --help' 를 실행해 보세요.",
  "error.optionNeedsValue": "옵션 {option} 에 값이 필요합니다. 'hookparity --help' 를 실행해 보세요.",
  "error.optionTakesNoValue": "옵션 {option} 에는 값을 붙이지 않습니다. 'hookparity --help' 를 실행해 보세요.",
  "error.badOption": "명령줄을 해석할 수 없습니다({code}). 'hookparity --help' 를 실행해 보세요.",
  "error.noCasesFile": "test 에는 케이스 파일이 하나 이상 필요합니다. 예: hookparity test hookparity.cases.json",
  "error.dirNotFound": "디렉터리를 찾을 수 없습니다: {dir}",
  "error.homeNotFound": "홈 디렉터리를 찾을 수 없습니다: {dir}",

  "finding.HP001": "{event} 의 `if` 는 실행되지 않습니다. Claude Code 는 도구 이벤트에서만 `if` 를 평가하므로 이 훅은 건너뜁니다(규칙: {rule}). `if` 를 빼거나 훅을 도구 이벤트로 옮기세요.",
  "finding.HP002.ignored": "이 에이전트는 `if` 조건({rule})을 무시합니다. 매처가 고른 모든 호출에서 훅이 실행됩니다.",
  "finding.HP002.widened": "Claude Code 에서는 이 명령이 `if` 조건({rule})으로 제한되지만 다음 에이전트에서는 필터 없이 실행되어 훨씬 많은 호출에 걸립니다: {agents}.",
  "finding.HP003": "매처에 권한 규칙 문법이 쓰였습니다: \"{matcher}\". 매처는 도구 이름만 보므로 절대 일치하지 않습니다. 인자 조건은 Claude Code `if` 에 쓰고 매처에는 도구 이름만 두세요.",
  "finding.HP004": "이 에이전트의 실제 MCP 도구 이름과 일치하지 않는 MCP 매처입니다: \"{matcher}\" (Claude Code: mcp__<서버>__<도구> 정확 일치 목록, Gemini CLI: mcp_<서버>_<도구>). Claude Code 에는 mcp__<서버>__.*, Gemini CLI 에는 mcp_<서버>_.* 를 쓰세요.",
  "finding.HP005.seconds": "시간 제한 {value} 은(는) 밀리초로 쓴 것 같지만 이 에이전트는 시간 제한을 초 단위로 읽어 {value}초(1시간 넘게) 기다립니다. 초 단위로 쓰세요(예: {suggest}).",
  "finding.HP005.milliseconds": "시간 제한 {value} 은(는) 초로 쓴 것 같지만 이 에이전트는 시간 제한을 밀리초 단위로 읽어 {value}밀리초만 기다립니다. 밀리초 단위로 쓰세요(예: {suggest}).",
  "finding.HP006": "{event} 이벤트는 이 에이전트에 없어서 이 훅들은 실행되지 않습니다.",
  "finding.HP007": "매처 \"{matcher}\" 에 다른 에이전트의 도구 이름({tools})이 있습니다. 이 에이전트는 도구 이름이 다릅니다.",
  "finding.HP008": "올바른 정규식이 아닌 매처라서 아무것도 일치하지 않습니다: \"{matcher}\".",
  "finding.HP009": "프로젝트 .codex 훅은 Codex 에서 프로젝트와 훅을 신뢰(/hooks)한 뒤에야 실행됩니다. hookparity 는 그 신뢰 상태를 읽을 수 없습니다.",
  "finding.HP101": "결정 JSON 이 이 에이전트가 읽는 위치에 없습니다(읽는 위치: `{read}`, 실제 위치: `{found}`). 훅은 허용으로 처리됩니다.",
  "finding.HP102": "종료 코드 {code} 은(는) 차단이 아닙니다(차단은 종료 코드 2 뿐). 도구 호출이 그대로 진행됩니다. 차단하려면 `exit 2` 를 쓰세요.",
  "finding.HP102.signal": "훅이 신호 {signal}(으)로 멈췄습니다. 차단이 아니므로(차단은 종료 코드 2 뿐) 도구 호출이 그대로 진행됩니다.",
  "finding.HP103": "Codex 는 permissionDecision \"ask\" 를 지원하지 않아 훅 실패로 보고 호출이 진행됩니다.",
  "finding.HP104.allow": "훅이 {sec}초 뒤 시간 초과됐습니다. 이 에이전트는 실패 시 차단으로 설정하지 않으면 호출을 진행하므로 호출이 허용됩니다.",
  "finding.HP104.block": "훅이 {sec}초 뒤 시간 초과됐고 실패 시 차단으로 설정돼 있어 호출이 차단됩니다.",
  "finding.HP105": "종료 코드 0 이지만 stdout 이 JSON 객체가 아닙니다(\"{sample}\"). 출력은 무시되고 호출이 진행됩니다.",
};
