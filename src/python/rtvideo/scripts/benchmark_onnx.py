import argparse
import logging
import os
import subprocess
import time
from multiprocessing import Barrier, Process

import numpy as np
import onnxruntime as ort


def gpu_count():
    if os.environ.get('CUDA_VISIBLE_DEVICES'):
        return len(os.environ['CUDA_VISIBLE_DEVICES'].split(','))

    gpu_output = subprocess.check_output(['nvidia-smi', '--query-gpu=gpu_name', '--format=csv,noheader']).decode().strip().split('\n')
    return len(gpu_output)

def run_model_on_gpu(model_path, input_shape, gpu_id, barrier):
    logger = logging.getLogger()  # Get the root logger
    logger.setLevel(logging.DEBUG)

    # Configure the session to use the CUDAExecutionProvider
    providers = [
        ('CUDAExecutionProvider', {'device_id': gpu_id}),
        'CPUExecutionProvider',
    ]

    # Load the ONNX model with the specified providers
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 2
    session = ort.InferenceSession(model_path, providers=providers, sess_options=options)

    # Generate a dummy input tensor
    input_tensor = np.random.rand(*input_shape).astype(np.float32)
    input_name = session.get_inputs()[0].name


    logger.info(f'GPU #{gpu_id} Warming model...')
    session.run(None, {input_name: input_tensor})
    logger.info(f'GPU #{gpu_id} Model warmed up, waiting for all processes ready.')
    barrier.wait()

    logger.info(f'GPU #{gpu_id} running model loop...')
    # Run the model 1000 times
    for _ in range(1000):
        start_ts = time.time()
        session.run(None, {input_name: input_tensor})
        end_ts = time.time()

        logger.info(f'GPU #{gpu_id} Inference time: {(end_ts - start_ts) * 1000:.1f} ms')

def main(model_path, parallelism, gpus):
    # Set up logging to print to stdout in the main process
    logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
    logger = logging.getLogger()

    input_shape = (1, 3, 512, 512)  # Input shape for the model

    barrier = Barrier(parallelism)

    logger.info(f'Configuring {parallelism}x parallel on {gpus} GPUs.')
    logger.info('Starting processes...')
    # Create and start a process for each GPU, assigning GPUs in a round-robin fashion
    processes = []
    for i in range(parallelism):
        gpu_id = i % gpus  # Round-robin assignment
        p = Process(target=run_model_on_gpu, args=(model_path, input_shape, gpu_id, barrier))
        p.start()
        processes.append(p)
        # Sleep for a few seconds to allow the process to start up
        time.sleep(2)

    # Wait for all processes to finish (they won't, due to the infinite loop, so this script will need to be manually terminated)
    for p in processes:
        p.join()

if __name__ == '__main__':
    default_parallelism = gpu_count() * 4
    parser = argparse.ArgumentParser(description='Run an ONNX model in parallel on GPUs.')
    parser.add_argument('model_path', type=str, help='Path to the ONNX model file.')
    parser.add_argument('--parallelism', type=int, help='Number of parallel processes to run.', default=default_parallelism)

    args = parser.parse_args()

    main(args.model_path, args.parallelism, gpu_count())
