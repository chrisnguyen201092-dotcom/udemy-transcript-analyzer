# Workflow 06: Deploy

## Khi nào dùng
- Sau khi integration pass
- Khi release phiên bản mới

## Môi trường
- **Development**: `npm run dev` (port 3000)
- **Production**: Docker (`docker compose up -d`)

## Bước thực hiện

### Option A: Docker (Khuyến nghị)

#### 1. Build image
```bash
docker compose build
```

#### 2. Test image locally
```bash
docker compose up -d
docker compose logs -f
# Truy cập http://localhost:3000
```

#### 3. Verify app
```bash
curl http://localhost:3000/api/courses  # → []
docker compose ps  # → running
```

#### 4. Nếu cần rebuild sau code change
```bash
docker compose down
docker compose up -d --build
docker compose logs -f
```

### Option B: Direct (Development only)
```bash
npm install
npx prisma generate
npx prisma db push
npm run build
npm start
```

## Database trong Production

### Backup trước khi deploy
```bash
cp prisma/dev.db prisma/dev.db.backup.$(date +%Y%m%d)
```

### Schema migration
```bash
# Prisma không có migration files — dùng db push
npx prisma db push
```

### Volume data
Docker volume `udemy_data` lưu database. Không bị mất khi rebuild.

## Environment Variables
```bash
# .env (không commit)
DATABASE_URL="file:./dev.db"
```

## Rollback
```bash
# Restore database backup
cp prisma/dev.db.backup.YYYYMMDD prisma/dev.db

# Rollback code
git checkout {previous-commit}
docker compose up -d --build
```

## Quy tắc
- KHÔNG commit `.env`
- KHÔNG hardcode secrets trong Dockerfile
- Test Docker build locally trước khi deploy
- Backup database trước mọi migration
