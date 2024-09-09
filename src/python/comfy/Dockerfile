FROM nvidia/cuda:12.0.0-base-ubuntu22.04

RUN apt-get update && \
    apt-get install -y libgl1-mesa-glx libglib2.0-0 python3 python3-pip git curl wget unzip jq  && \
    pip3 install comfy-cli

RUN comfy --skip-prompt install --nvidia

COPY ./snapshot.yaml /root/comfy/ComfyUI/snapshot.yaml
RUN comfy node restore-snapshot /root/comfy/ComfyUI/snapshot.yaml

COPY ./models /root/comfy/ComfyUI/model-scripts
COPY ./.envrc /root/comfy/ComfyUI/.envrc

EXPOSE 8188

CMD [ "/usr/local/bin/comfy", "launch", "--", "--listen", "0.0.0.0"]
