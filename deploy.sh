#!/bin/bash
set -e

echo "=== KIEP 배포 스크립트 ==="

# 1. 프론트엔드 빌드
echo "[1/4] 프론트엔드 빌드 중..."
cd web
npm ci
npm run build
cd ..

# 2. 환경변수 확인
if [ ! -f .env.prod ]; then
    echo "[오류] .env.prod 파일이 없습니다."
    echo "       cp .env.prod.example .env.prod  후 값을 채워주세요."
    exit 1
fi

# 3. Docker 이미지 빌드 + 실행
echo "[2/4] Docker 이미지 빌드 중..."
docker compose -f docker-compose.prod.yml --env-file .env.prod build

echo "[3/4] 서비스 시작 중..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d

# 4. 상태 확인
echo "[4/4] 상태 확인..."
sleep 5
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=== 배포 완료 ==="
echo "API 확인: curl http://localhost/api/v1/health/ping"
echo ""
