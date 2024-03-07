import subprocess
import os
import signal
import sys
import time
import threading

def print_output(stream, label):
    """
    Read from a stream line by line and print each line.
    """
    for line in iter(stream.readline, ''):
        print(f"{label}: {line}", end='')

def run_script(label, command):
    print(f"Running script: {label}\n{command}\n")
    try:
        proc = subprocess.Popen(command, shell=True,  
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, 
            stderr=subprocess.PIPE, text=True, bufsize=1, universal_newlines=True, preexec_fn=os.setpgrp)

        # Create threads to read stdout and stderr
        stdout_thread = threading.Thread(target=print_output, args=(proc.stdout, "STDOUT"))
        stderr_thread = threading.Thread(target=print_output, args=(proc.stderr, "STDERR"))

        # Start the threads
        stdout_thread.start()
        stderr_thread.start()

        # Wait for the subprocess to finish while the threads read the output
        proc.wait()

        # Wait for the output threads to finish
        stdout_thread.join()
        stderr_thread.join()

        if proc.returncode != 0:
            print(f"\nError running script {label} with return code {proc.returncode}")
    except KeyboardInterrupt:
        print(f"\nInterrupt received for script: {label}. Killing script...")
        # Send SIGTERM to the process group of the subprocess to kill it and its children
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        time.sleep(1)  # Give a short moment to handle the signal
        # Send SIGKILL to the process group of the subprocess to kill it and its children
        os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        # Wait for the threads
        print("Waiting for threads to finish...")
        proc.stdin.close()
        stdout_thread.join()
        stderr_thread.join()
        print(f"Killed script: {label}")

def ask_for_confirmation(label):
    response = input(f"Do you want to run the script '{label}'? (Y/n): ").strip().lower()
    return response in ("", "y", "yes")

def run_scripts(scripts_to_run):
    print(f"Running {len(scripts_to_run)} scripts...")
    try:
        for label, command in scripts_to_run:
            if ask_for_confirmation(label):
                    run_script(label, command)
            else:
                print(f"Skipping script {label}.")
    
    except KeyboardInterrupt:
        print("Interrupt received. Stopping all scripts.")

    print("Finished running scripts.")

if __name__ == "__main__":
    run_scripts([
        ("Sleep", "sleep 5", ),
        ("Print Hello World", "echo 'Hello, World!'", ),
        ("List files in current directory", "ls", ),
        ("Print current working directory", "pwd", ),
        ("Print Python version", "python --version", ),
    ])