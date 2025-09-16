HEAD

# Frontend (Vercel)

## Deploy

- Push thư mục `frontend/` lên GitHub.
- Vercel: Import repo → Framework = Other, Build Command = (trống), Output Directory = `frontend`.

## Config

- Trong `index.html`, sửa:
  - `API_BASE_URL` & `SOCKET_URL`
  - `G-XXXXXXX` thành Google Analytics ID

# Backend (Express + Socket.IO)

## Local

```bash
cd backend
npm install
npm run dev
```

b310d907cd456ea0359633586456eda120ac2306
