# HoloElements

웹캠으로 손동작을 인식해 3D 원자 모형을 조작하고, 화면을 투명 피라미드/반사판과 함께 사용해 홀로그램처럼 보이게 만드는 브라우저 프로젝트입니다.

## 현재 기능

- 원소 1~20(수소~칼슘)
- 3D 원자핵 + 전자 궤도 시각화
- 엄지+검지 집기: 원자 이동
- 손바닥 이동: 회전
- 두 손 거리: 확대/축소
- 좌우 스와이프: 이전/다음 원소
- 일반 화면 모드
- 투명 피라미드용 4방향 홀로그램 모드
- 마우스/터치 드래그 회전 fallback

> 주의: 화면과 투명 반사판으로 만드는 방식은 물리적으로 빛의 파면을 복원하는 '진짜 홀로그램'이 아니라 Pepper's Ghost 계열의 유사 홀로그램 표현입니다.

## 실행

카메라 API 때문에 `index.html` 파일을 그냥 열기보다 **HTTPS 또는 localhost**에서 실행해야 합니다.

### PC

프로젝트 폴더에서:

```bash
python -m http.server 8080
```

그 다음 브라우저에서:

```text
http://localhost:8080
```

### GitHub Pages

1. 이 폴더의 파일을 GitHub 저장소 루트에 올립니다.
2. 저장소 Settings → Pages에서 main 브랜치의 root를 배포 대상으로 선택합니다.
3. 생성된 HTTPS 주소로 접속합니다.
4. `손 인식 시작`을 누르고 카메라 권한을 허용합니다.

## 홀로그램 모드

`홀로그램 모드: ON`을 누르면 같은 3D 장면이 상/하/좌/우 네 방향으로 배치됩니다. 스마트폰/태블릿 화면 중앙에 투명 피라미드 또는 반사판을 배치하는 방식에 맞춘 출력입니다.

## 과학적 표현

현재 원자 모형은 교육/인터랙션용 Bohr 스타일 시각화입니다. 원자 크기, 입자 크기, 전자 위치를 실제 축척으로 표현하지 않습니다. 더 정확한 버전을 만들려면 전자 궤도 대신 확률 밀도(전자 구름) 셰이더를 추가하는 것이 좋습니다.

## 사용 라이브러리

- Three.js 0.185.1
- MediaPipe Tasks Vision 1.0.1
- MediaPipe Hand Landmarker model

관련 공식 문서:
- https://threejs.org/manual/en/installation.html
- https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js
