import onnx
import tensorrt as trt
import sys

def get_input_shape(onnx_path):
    # Load the ONNX model
    onnx_model = onnx.load(onnx_path)

    # Get the input shape
    onnx_model.graph.input[0].type.tensor_type.shape.dim[0].dim_value = 1
    input_shape = onnx_model.graph.input[0].type.tensor_type.shape.dim
    input_shape = [dim.dim_value for dim in input_shape]

    print(f"Input shape: {input_shape}")
    return input_shape

def build_engine(onnx_path):
    input_shape = get_input_shape(onnx_path)

    TRT_LOGGER = trt.Logger(trt.Logger.VERBOSE)
    builder = trt.Builder(TRT_LOGGER)
    network_flags = (1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH))
    config = builder.create_builder_config()
    config.max_workspace_size = 2 << 30  # Adjust workspace size to 2GB
    network = builder.create_network(network_flags)
    parser = trt.OnnxParser(network, TRT_LOGGER)

    # Parse ONNX model
    with open(onnx_path, 'rb') as model:
        print('Beginning ONNX file parsing, file: ', onnx_path)
        if not parser.parse(model.read()):
            print('ERROR: Failed to parse the ONNX file.')
            for error in range(parser.num_errors):
                print('\t', parser.get_error(error))
            return None

    # Reshape input to the obtained input shape
    input_tensor = network.get_input(0)
    input_tensor.shape = input_shape

    # Build engine
    print('Building an engine...')
    engine = builder.build_engine(network, config)
    print("Completed creating Engine")

    return engine

def save_engine(engine, file_name):
    serialized_engine = engine.serialize()
    with open(file_name, 'wb') as f:
        f.write(serialized_engine)

def main():
    onnx_file_path = sys.argv[1]  # Get the path of the onnx file from command line argument
    engine_file_path = "model.engine"  # Specify the path to save the engine file

    # Build the engine
    engine = build_engine(onnx_file_path)

    # Save the engine
    save_engine(engine, engine_file_path)

if __name__ == "__main__":
    main()