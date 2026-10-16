# 서버 코드를 자동으로 반영하기

지금은 `Code.gs` 를 손으로 붙여넣고 배포 관리에서 새 버전을 만들어야 한다.
clasp 를 쓰면 그 두 단계가 명령 한 줄이 되고, 깃허브 액션까지 붙이면 아예 사라진다.

## 1단계 — 내 PC에서 (붙여넣기가 없어진다)

```bash
npm i -g @google/clasp
clasp login                      # 브라우저가 열린다. 구글 계정으로 허용
```

먼저 https://script.google.com/home/usersettings 에서 **Google Apps Script API** 를 켠다.
켜지 않으면 clasp 가 프로젝트에 닿지 못한다.

```bash
cd server
clasp clone <스크립트ID>          # 앱스 스크립트 주소의 /projects/<여기>/edit
```

`clasp clone` 이 `.clasp.json` 과 `appsscript.json` 을 만들어 준다.
**둘 다 그대로 커밋한다.** 특히 `appsscript.json` 은 지금 프로젝트의 실제 설정이므로
직접 쓰지 말고 clone/pull 로 받은 것을 쓴다. 웹앱 접근 권한이 여기 들어 있다.

이후 코드를 고치면:

```bash
cd server
clasp push                       # 코드 올리기 (편집기에서 저장한 것과 같다)
clasp deployments                # 지금 쓰는 배포의 ID 를 확인한다
clasp deploy -i <배포ID> -d "설명"  # 같은 주소로 새 버전 배포
```

`-i <배포ID>` 를 빼면 **새 배포가 생겨 /exec 주소가 바뀐다.** 반드시 붙인다.

## 2단계 — 깃허브 액션 (고치면 알아서 반영된다)

`.github/workflows/apps-script.yml` 이 이미 들어 있다. 비밀값 두 개만 넣으면 켜진다.

저장소 **Settings → Secrets and variables → Actions → New repository secret**

| 이름 | 값 |
|---|---|
| `CLASPRC_JSON` | PC의 `~/.clasprc.json` 내용 전부 |
| `DEPLOYMENT_ID` | `clasp deployments` 가 보여 준 배포 ID |

넣고 나면 `server/` 안의 파일이 바뀔 때마다 올라가고 같은 주소로 다시 배포된다.

### 알아 둘 것

- `~/.clasprc.json` 에는 구글 계정의 갱신 토큰이 들어 있다. 이 저장소에 쓰기 권한이 있는
  사람은 그 토큰으로 내 앱스 스크립트 프로젝트를 건드릴 수 있다. 개인 저장소로 두어야 한다.
- 토큰은 만료되거나 취소될 수 있다. 그러면 액션이 실패하므로, 배포가 안 되는 것 같으면
  Actions 탭을 먼저 본다. `clasp login` 을 다시 하고 비밀값을 갱신하면 된다.
- 잘못된 코드도 그대로 배포된다. 그래서 올리기 전에 문법 확인을 한 단계 넣어 두었다.
