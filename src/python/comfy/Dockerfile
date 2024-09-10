FROM nvidia/cuda:12.0.0-base-ubuntu22.04

RUN apt-get update && \
    apt-get install -y libgl1-mesa-glx libglib2.0-0 python3 python3-pip git curl wget supervisor unzip jq  && \
    pip3 install comfy-cli && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

RUN comfy --skip-prompt install --nvidia

RUN mkdir -p /var/log/supervisor \
    && mkdir -p /opt/filebrowser \
    && cd /opt/filebrowser \
    && wget https://github.com/filebrowser/filebrowser/releases/download/v2.23.0/linux-amd64-filebrowser.tar.gz \
    && tar -xvzf linux-amd64-filebrowser.tar.gz \
    && ./filebrowser config init \
    && ./filebrowser users add admin comfyui \
    && ./filebrowser config set \
    --auth.method noauth \
    --branding.name "ComfyUI" \
    --branding.files "/opt/filebrowser/branding" \
    --root "/workspace" \
    --address "0.0.0.0" \
    && rm linux-amd64-filebrowser.tar.gz

COPY ./snapshot.yaml /root/comfy/ComfyUI/snapshot.yaml
RUN comfy node restore-snapshot /root/comfy/ComfyUI/snapshot.yaml

COPY ./comfyd.sh /root/comfy/ComfyUI/service.sh
RUN chmod +x /root/comfy/ComfyUI/service.sh

COPY ./supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY ./filebrowser /opt/filebrowser/branding
COPY ./models /root/comfy/ComfyUI/model-scripts
COPY ./.envrc /root/comfy/ComfyUI/.envrc


EXPOSE 8188
EXPOSE 8080

CMD [ "/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/supervisord.conf" ]
