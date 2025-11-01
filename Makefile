.PHONY: build run all

# Docker image name
IMAGE_NAME = volandoo/fluxiondb
SECRET_KEY = my-secret-key
	
# Build the Docker image
build:
	docker build -t $(IMAGE_NAME) .

# Run the container and mount data dir to tmp_data on host
run:
	docker run --init --rm -it -p 8080:8080 -v $(PWD)/tmp_data:/app/data $(IMAGE_NAME) --secret-key=$(SECRET_KEY) --data=/app/data


# Build and run in one command
all: build run 
