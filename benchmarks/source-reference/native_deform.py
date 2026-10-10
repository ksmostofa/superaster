"""Fixed-shape torchvision 0.20.1 -> standard ONNX opset-19 DeformConv.

Research proposal. Operator/runtime parity must precede production use.
Maps the actual pinned TorchVision schema; does not implement a new kernel.
"""
import torch
from torch.onnx import symbolic_helper as helper

@helper.parse_args('v','v','v','v','v','i','i','i','i','i','i','i','i','b')
def deform_conv(g, image, weight, offset, mask, bias, stride_h, stride_w,
                pad_h, pad_w, dilation_h, dilation_w, groups, offset_groups, use_mask):
    # The pinned legacy exporter can lose spatial metadata after intermediate
    # shape operations even for a physically fixed 1024 input. Such metadata
    # is not required by the ONNX operator; preserve unknown sizes as unknown.
    image_shape=helper._get_tensor_sizes(image,allow_nonstatic=True)
    weight_shape=helper._get_tensor_sizes(weight,allow_nonstatic=False)
    rank=helper._get_tensor_rank(image)
    if rank is not None and rank!=4:raise ValueError('The selected source operation requires NCHW rank 4')
    if weight_shape is None or len(weight_shape)!=4:
        raise ValueError(f'The reviewed export requires fixed OIHW weight dimensions: {weight_shape}')
    if image_shape is None:image_shape=[None,None,None,None]
    kernel_h,kernel_w=weight_shape[2:]
    out_h=None if image_shape[2] is None else (image_shape[2]+2*pad_h-dilation_h*(kernel_h-1)-1)//stride_h+1
    out_w=None if image_shape[3] is None else (image_shape[3]+2*pad_w-dilation_w*(kernel_w-1)-1)//stride_w+1
    inputs=[image,weight,offset,bias]
    if use_mask:inputs.append(mask)
    value=g.op('DeformConv',*inputs,kernel_shape_i=[kernel_h,kernel_w],
               strides_i=[stride_h,stride_w],pads_i=[pad_h,pad_w,pad_h,pad_w],
               dilations_i=[dilation_h,dilation_w],group_i=groups,offset_group_i=offset_groups)
    # Supply only dimensions established by source metadata/ONNX semantics.
    # The full graph's input/output contract is still checked by the producer.
    return value.setType(image.type().with_sizes([image_shape[0],weight_shape[0],out_h,out_w]))

def register():
    torch.onnx.register_custom_op_symbolic('torchvision::deform_conv2d',deform_conv,19)
