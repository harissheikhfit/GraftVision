import onnx
from onnx import helper, TensorProto
import numpy as np
import hashlib

def main():
    # Input: float32 tensor of shape [1, 100]
    input_info = helper.make_tensor_value_info('input', TensorProto.FLOAT, [1, 100])
    
    # Output: float32 tensor of shape [1, 4]
    output_info = helper.make_tensor_value_info('output', TensorProto.FLOAT, [1, 4])
    
    # Weights for MatMul (100x4) - mostly zeros
    weights_np = np.zeros((100, 4), dtype=np.float32)
    weights_init = helper.make_tensor(
        name='weights',
        data_type=TensorProto.FLOAT,
        dims=[100, 4],
        vals=weights_np.flatten().tolist()
    )
    
    # Bias for Add (4)
    bias_np = np.array([0.9, 0.5, -1.0, 1.0], dtype=np.float32)
    bias_init = helper.make_tensor(
        name='bias',
        data_type=TensorProto.FLOAT,
        dims=[4],
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
        name='SyntheticScalpSegmentation',
        inputs=[input_info],
        outputs=[output_info],
        initializer=[weights_init, bias_init]
    )
    
    # Model
    model = helper.make_model(graph, producer_name='graftvision-tooling')
    model.opset_import[0].version = 13
    
    out_path = 'packages/database/src/assets/graftvision-synthetic-scalp-segmentation-0.1.0.onnx'
    onnx.save(model, out_path)
    
    # Compute SHA256
    with open(out_path, 'rb') as f:
        model_bytes = f.read()
        sha256_hash = hashlib.sha256(model_bytes).hexdigest()
        
    print(f"Model generated at {out_path}")
    print(f"SHA-256 Hash: {sha256_hash}")
    print("\nPlease update EXPECTED_ONNX_SHA256 in packages/database/src/onnx-ai-map-adapter.ts and tooling/verify-ai-map-policy.mjs with this hash.")

if __name__ == '__main__':
    main()
