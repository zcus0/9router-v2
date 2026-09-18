docker stop 9router-v2
docker rm 9router-v2
docker build -t zcus0/9router-v2 .
docker run -d --name 9router-v2 -p 20135:20135 --env-file .env -v 9router-v2-data:/app/data zcus0/9router-v2