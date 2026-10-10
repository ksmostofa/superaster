"""Fixed-shape torchvision 0.20.1 -> standard ONNX opset-19 DeformConv.

Research proposal. Operator/runtime parity must precede production use.
Maps the actual pinned TorchVision schema; does not implement a new kernel.
"""
import torch
from torch.onnx import symbolic_helper as helper

@helper.parse_args('v','v','v','v','v','i','i','i','i','i','i','i','i','b')
def deform_conv(g, image, weight, offset, mask, bias, stride_h, stride_w,
                pad_h, pad_w, dilation_h, dilation_w, groups, offset_groups, use_mask):
    image_shape=helper._get_tensor_sizes(image,allow_nonstatic=False)
    weight_shape=helper._get_tensor_sizes(weight,allow_nonstatic=False)
    if image_shape is None or weight_shape is None or len(image_shape)!=4 or len(weight_shape)!=4:
        raise ValueError('The reviewed export requires fixed NCHW image and OIHW weight dimensions')
    kernel_h,kernel_w=weight_shape[2:]
    out_h=(image_shape[2]+2*pad_h-dilation_h*(kernel_h-1)-1)//stride_h+1
    out_w=(image_shape[3]+2*pad_w-dilation_w*(kernel_w-1)-1)//stride_w+1
    inputs=[image,weight,offset,bias]
    if use_mask:inputs.append(mask)
    value=g.op('DeformConv',*inputs,kernel_shape_i=[kernel_h,kernel_w],
               strides_i=[stride_h,stride_w],pads_i=[pad_h,pad_w,pad_h,pad_w],
               dilations_i=[dilation_h,dilation_w],group_i=groups,offset_group_i=offset_groups)
    # The fixed export makes output dimensions explicit for downstream Torch
    # symbolic shape handling. This follows the ONNX convolution shape formula.
    return value.setType(image.type().with_sizes([image_shape[0],weight_shape[0],out_h,out_w]))

def register():
    torch.onnx.register_custom_op_symbolic('torchvision::deform_conv2d',deform_conv,19)
