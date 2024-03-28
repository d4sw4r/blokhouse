# syntax=docker/dockerfile:1

# USAGE: docker build -t godocker:multistage -f Dockerfile.multistage .

##
## STEP 1 - BUILD
##

# specify the base image to  be used for the application, alpine or ubuntu
FROM golang:1.21.5-alpine3.18 AS build

# create a working directory inside the image
WORKDIR /app

#enable v1 dependencies
RUN export GO111MODULE=on

# copy directory files i.e all files ending with .go
COPY . ./

# download Go modules and dependencies
RUN go mod download

# download and install templ
RUN go install github.com/a-h/templ/cmd/templ@latest

# compile templates
RUN templ generate

# compile application
RUN go build -o /godocker

##
## STEP 2 - DEPLOY
##
FROM scratch

WORKDIR /

COPY --from=build /godocker /godocker

#copy static css,js,images into the container
COPY static ./static

EXPOSE 8080

ENTRYPOINT ["/godocker"]