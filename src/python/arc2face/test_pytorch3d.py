import torch
from pytorch3d.utils import ico_sphere


def test_pytorch3d():
    # Check if CUDA is available and set the device accordingly
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # Create a sphere mesh
    sphere_mesh = ico_sphere(level=3, device=device)

    # Print some properties of the mesh to verify it's working
    print("Sphere Mesh:")
    print(f"Vertices shape: {sphere_mesh.verts_packed().shape}")
    print(f"Faces shape: {sphere_mesh.faces_packed().shape}")


if __name__ == "__main__":
    test_pytorch3d()
