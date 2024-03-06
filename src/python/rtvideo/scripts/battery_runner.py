import subprocess
import os
import signal
import sys
import time  # For demonstration purposes in the delay

def run_script(label, command):
    print(f"Running script: {label}")
    try:
        # Start the subprocess in a new process group
        proc = subprocess.Popen(command, shell=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, preexec_fn=os.setpgrp)
        
        # Wait for the subprocess to finish
        stdout, stderr = proc.communicate()
        
        if proc.returncode == 0:
            print(f"Output:\n{stdout}")
        else:
            print(f"Error running script {label}:\n{stderr}")
    except KeyboardInterrupt:
        print(f"\nInterrupt received for script: {label}. Killing script...")
        # Send SIGTERM to the process group of the subprocess to kill it and its children
        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        # Give a short moment to handle the signal
        time.sleep(1)
        print(f"Killed script: {label}")

def ask_for_confirmation(label):
    response = input(f"Do you want to run the script '{label}'? (Y/n): ").strip().lower()
    return response in ("", "y", "yes")

def run_scripts(scripts_to_run):
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