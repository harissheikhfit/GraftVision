import onnx
from onnx import helper, TensorProto
import numpy as np
import hashlib

def main():
    # Input: float32 tensor of shape [1, 100]
    input_info = helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, 100])
    
    # Output: float32 tensor of shape [1, 500]
    output_info = helper.make_tensor_value_info('output', TensorProto.FLOAT, [1, 500])
    
    # Weights for MatMul (100x500) - mostly zeros
    weights_np = np.zeros((100, 500), dtype=np.float32)
    weights_init = helper.make_tensor(
        name='weights',
        data_type=TensorProto.FLOAT,
        dims=[100, 500],
        vals=weights_np.flatten().tolist()
    )
    
    # Bias for Add (500)
    bias_np = np.zeros(500, dtype=np.float32)
    
    # We want these points to be deterministic and somewhat within [-2.0, 2.0].
    # Let's just generate a smooth pattern of values between -1.0 and 1.0.
    for i in range(500):
        bias_np[i] = np.sin(i * 0.1) * 1.5

    bias_init = helper.make_tensor(
        name='bias',
        data_type=TensorProto.FLOAT,
        dims=[500],
        vals=bias_np.tolist()
    )
    
    # Nodes
    matmul_node = helper.make_node(
        'MatMul',
        inputs=['input', 'weights'],
        outputs=['matmul_out'],
        name='matmul_node'
    )
    
    add_node = helper.make_node(
        'Add',
        inputs=['matmul_out', 'bias'],
        outputs=['output'],
        name='add_node'
    )
    
    # Graph
    graph = helper.make_graph(
        nodes=[matmul_node, add_node],
        name='SyntheticExpandedScalpSegmentation',
        inputs=[input_info],
        outputs=[output_info],
        initializer=[weights_init, bias_init]
    )
    
    # Model
    model = helper.make_model(graph, producer_name='graftvision-tooling')
    # onnxruntime-node@1.18.0 accepts ONNX IR versions through 10.
    model.ir_version = 10
    model.opset_import[0].version = 13
    
    out_path = 'packages/database/src/assets/graftvision-synthetic-scalp-segmentation-expanded-0.1.0.onnx'
    onnx.save(model, out_path)

    # Print the SHA-256 hash
    with open(out_path, "rb") as f:
        bytes = f.read()
        sha256_hash = hashlib.sha256(bytes).hexdigest()
        print(f"Expanded Model SHA-256: {sha256_hash}")

if __name__ == '__main__':
    main()
