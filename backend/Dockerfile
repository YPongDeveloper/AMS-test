# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /ams-backend .

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /ams-backend /ams-backend
EXPOSE 8080
ENTRYPOINT ["/ams-backend"]
