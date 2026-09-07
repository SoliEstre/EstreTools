# Mermaid 보고서

## 처리 흐름

본문 **강조**와 `a * b`, \* 이스케이프를 보존합니다.

```mermaid
flowchart LR
  A["요청 & 확인"] --> B["결과 <완료>"]
```

## 호출 순서

```mermaid
sequenceDiagram
  participant U as 사용자
  participant S as 서비스
  U->>S: 요청 전송
  S-->>U: 응답 반환
```

| 항목 | 값 |
| --- | ---: |
| 상태 | 완료 |

```js
const text = "**literal** & <tag> `code`";
// ~~~ must not close a backtick fence
```

````text
```nested
# literal heading * literal
```
````
