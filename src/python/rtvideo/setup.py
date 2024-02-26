from setuptools import setup, find_packages

setup(
    name='rtvideo',
    version='0.1.0',
    author='Patrick Hulce',
    author_email='patrick.hulce@gmail.com',
    description='A real-time video processing package.',
    long_description=open('README.md').read(),
    long_description_content_type='text/markdown',
    url='https://github.com/patrickhulce/corellia/blob/main/src/python/rtvideo',
    package_dir={'': 'src'},
    packages=find_packages(where='src'),
    python_requires='>=3.10',
    install_requires=[
        'numpy',
        'opencv-python',
        'cupy',
        'onnxruntime-gpu',
    ],
)