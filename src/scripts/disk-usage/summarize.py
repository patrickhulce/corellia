import asyncio
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from subprocess import PIPE
from typing import Dict

import aiofiles
import pandas as pd

# Add logging configuration
logging.basicConfig(
    format="%(asctime)s - %(message)s", level=logging.INFO, datefmt="%Y-%m-%d %H:%M:%S"
)


@dataclass
class DirNode:
    path: Path
    size: int  # immediate size in bytes
    total_size: int = 0  # total size including children
    file_count: int = 0  # immediate file count
    total_file_count: int = 0  # total file count including children
    children: Dict[str, "DirNode"] = field(default_factory=dict)

    def size_gb(self) -> float:
        """Convert bytes to GB for display"""
        return self.size / (1024 * 1024 * 1024)

    def total_size_gb(self) -> float:
        """Convert total bytes to GB for display"""
        return self.total_size / (1024 * 1024 * 1024)


async def run_du(directory: str) -> str | None:
    """Get directory size by summing all immediate file sizes using find."""
    logging.info(f"Measuring {directory}...")
    process = await asyncio.create_subprocess_shell(
        # Use find to sum sizes of immediate files only
        "find . -maxdepth 1 -type f -ls | awk '{total += $7} END {print total}'",
        cwd=directory,
        stdout=PIPE,
        stderr=PIPE,
    )
    stdout, stderr = await process.communicate()
    if process.returncode == 0 and stdout.strip():
        try:
            size_bytes = int(stdout.strip())
            return f"{size_bytes}\t{directory}"
        except ValueError:
            logging.error(f"Error parsing size for {directory}: {stdout.decode()}")
    else:
        logging.error(
            f"Error measuring {directory}: {stdout.decode()} {stderr.decode()}"
        )
    return None


async def load_cache(cache_file: str) -> Dict[str, DirNode]:
    """Load previous results from CSV cache and build DirNode hierarchy."""
    try:
        df = pd.read_csv(cache_file, encoding="ascii")
        # Filter out rows where path is empty or not a string
        df = df[df["path"].notna()]
        df["path"] = df["path"].astype(str)
        # Convert all paths to absolute and sort by depth (parent dirs first)
        df["abs_path"] = df["path"].apply(lambda x: str(Path(x).absolute()))
        df["depth"] = df["abs_path"].str.count("/")
        df = df.sort_values("depth")

        # Initialize dict to store all nodes
        nodes: Dict[str, DirNode] = {}

        # Create nodes for each row
        for _, row in df.iterrows():
            path = Path(row["path"])
            node = DirNode(
                path=path,
                size=int(row["immediate_size_gb"] * (1024 * 1024 * 1024)),
                total_size=int(row["total_size_gb"] * (1024 * 1024 * 1024)),
                file_count=row["immediate_files"],
                total_file_count=row["total_files"],
            )
            nodes[str(path.absolute())] = node

            # Link to parent if exists
            parent_path = str(path.parent.absolute())
            if parent_path in nodes:
                nodes[parent_path].children[path.name] = node

        logging.info(f"Loaded cache with {len(nodes)} entries")
        return nodes
    except FileNotFoundError:
        logging.info("No cache found, starting fresh")
        return {}


async def crawl_directory_tree(
    root_path: str,
    depth: int,
    max_concurrent_tasks: int,
    csv_file: aiofiles.threadpool.AsyncTextIOWrapper,
    cache: Dict[str, tuple] = None,
) -> DirNode:
    """Build directory tree with sizes in a single pass."""
    sem = asyncio.Semaphore(max_concurrent_tasks)
    write_lock = asyncio.Lock()
    cache = cache or {}

    async def write_cached_node_to_csv(node: DirNode) -> None:
        """Helper function to write a node and all its children to CSV"""
        async with write_lock:
            await csv_file.write(
                f"{node.path.absolute()},{node.size_gb():.6f},{node.total_size_gb():.6f},"
                f"{node.file_count},{node.total_file_count}\n"
            )

        for child in node.children.values():
            await write_cached_node_to_csv(child)
        await csv_file.flush()
        os.fsync(csv_file.fileno())

    async def crawl(directory: str, current_depth: int) -> DirNode:
        if current_depth > depth:
            return DirNode(Path(directory), 0, 0)

        # Check if directory exists in cache
        dir_path = str(Path(directory).absolute())
        if dir_path in cache:
            logging.info(f"Using cached data for {directory}")
            node = cache[dir_path]
            await write_cached_node_to_csv(node)  # Write node and all its children
            return node

        logging.info(f"Crawling {directory}...")
        try:
            # Get the directory contents under the semaphore
            async with sem:
                immediate_size = 0
                file_count = 0
                entries = list(os.scandir(directory))
                tasks = []

                for entry in entries:
                    if entry.is_file(follow_symlinks=False):
                        try:
                            immediate_size += entry.stat().st_size
                            file_count += 1
                        except (OSError, FileNotFoundError):
                            continue
                    elif entry.is_dir():
                        tasks.append(crawl(entry.path, current_depth + 1))

            # Process child directories outside the semaphore
            if tasks:
                logging.info(f"Found {len(tasks)} children for {directory}")
                children = await asyncio.gather(*tasks)
                child_dirs = {Path(child.path).name: child for child in children}
                total_size = immediate_size + sum(
                    child.total_size for child in children
                )
                total_file_count = file_count + sum(
                    child.total_file_count for child in children
                )
                total_size_gb = total_size / (1024 * 1024 * 1024)
                logging.info(
                    f"Completed {directory} - {total_file_count} files, {total_size_gb:.2f} GB"
                )
            else:
                child_dirs = {}
                total_size = immediate_size
                total_file_count = file_count
                logging.info(f"No children for {directory}")

            node = DirNode(
                path=Path(directory),
                size=immediate_size,
                total_size=total_size,
                file_count=file_count,
                total_file_count=total_file_count,
                children=child_dirs,
            )

            # Write to CSV as we process each directory
            async with write_lock:
                await csv_file.write(
                    f"{node.path.absolute()},{node.size_gb():.6f},{node.total_size_gb():.6f},"
                    f"{node.file_count},{node.total_file_count}\n"
                )
                await csv_file.flush()  # Ensure it's written to disk
                os.fsync(csv_file.fileno())

            logging.info(
                f"Returning node for {directory} ({node.total_size_gb():.2f} GB)"
            )
            return node

        except (PermissionError, FileNotFoundError) as e:
            logging.error(f"Error measuring {directory}: {e}")
            return DirNode(Path(directory), 0, 0)
        except Exception as e:
            logging.error(f"Unexpected error in {directory}: {e}")
            return DirNode(Path(directory), 0, 0)

    return await crawl(root_path, 0)


def print_tree(
    node: DirNode,
    prefix: str = "",
    is_last: bool = True,
    current_depth: int = 0,
    max_depth: int = None,
) -> None:
    if max_depth is not None and current_depth > max_depth:
        return

    connector = "└── " if is_last else "├── "
    logging.info(
        f"{prefix}{connector}{node.path.name} ({node.total_size_gb():.2f} GB, {node.total_file_count} total files)"
    )

    if max_depth is not None and current_depth == max_depth:
        return

    child_prefix = prefix + ("    " if is_last else "│   ")
    children = sorted(node.children.values(), key=lambda x: x.total_size, reverse=True)
    for i, child in enumerate(children):
        print_tree(
            child, child_prefix, i == len(children) - 1, current_depth + 1, max_depth
        )


async def main(
    root_path: str,
    crawl_depth: int,
    summary_depth: int,
    max_parallelism: int,
    output_file: str,
) -> None:
    results_file = output_file + ".csv"

    # Load cache from previous run
    cache = await load_cache(results_file)
    # Backup existing results file
    if os.path.exists(results_file):
        os.rename(results_file, "." + results_file + ".bak")

    async with aiofiles.open(results_file, mode="w") as f:
        await f.write(
            "path,immediate_size_gb,total_size_gb,immediate_files,total_files\n"
        )

        logging.info("Building directory tree...")
        root = await crawl_directory_tree(
            root_path, crawl_depth, max_parallelism, f, cache
        )

        logging.info("\nDirectory Size Tree:")
        print_tree(root, max_depth=summary_depth)
        logging.info("")

        logging.info(f"Total size: {root.total_size_gb():.2f} GB")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Measure directory sizes in parallel.")
    parser.add_argument("--root", type=str, help="Root directory path", default=".data")
    parser.add_argument(
        "--crawl-depth", type=int, help="Depth to crawl directories", default=10
    )
    parser.add_argument(
        "--summary-depth", type=int, help="Depth to show in summary", default=3
    )
    parser.add_argument(
        "--max_parallelism",
        type=int,
        help="Maximum parallel tasks",
        default=3,
    )
    parser.add_argument(
        "--output_file",
        type=str,
        help="Output file for intermediate results",
        default="report.txt",
    )
    args = parser.parse_args()

    asyncio.run(
        main(
            args.root,
            args.crawl_depth,
            args.summary_depth,
            args.max_parallelism,
            args.output_file,
        )
    )
