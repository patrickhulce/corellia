import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict

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


def load_cache(cache_file: str) -> Dict[str, DirNode]:
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


@dataclass
class FlushWrapper:
    file_handle: Any
    writes_since_flush: int = 0

    def write(self, s: str):
        self.file_handle.write(s)
        self.writes_since_flush += 1
        if self.writes_since_flush > 100:
            self.file_handle.flush()
            os.fsync(self.file_handle.fileno())


def crawl_directory_tree(
    root_path: str,
    depth: int,
    max_concurrent_tasks: int,
    csv_file,
    cache: Dict[str, tuple] = None,
) -> DirNode:
    """Build directory tree with sizes in a single pass."""
    cache = cache or {}
    csv_file = FlushWrapper(csv_file)

    def write_cached_node_to_csv(node: DirNode) -> None:
        """Helper function to write a node and all its children to CSV"""
        csv_file.write(
            f"{node.path.absolute()},{node.size_gb():.6f},{node.total_size_gb():.6f},"
            f"{node.file_count},{node.total_file_count}\n"
        )

        for child in node.children.values():
            write_cached_node_to_csv(child)

    def crawl(directory: str, current_depth: int) -> DirNode:
        if current_depth > depth:
            return DirNode(Path(directory), 0, 0)

        # Check if directory exists in cache
        dir_path = str(Path(directory).absolute())
        if dir_path in cache:
            logging.info(f"Using cached data for {directory}")
            node = cache[dir_path]
            write_cached_node_to_csv(node)
            return node

        logging.info(f"Crawling {directory}...")
        try:
            immediate_size = 0
            file_count = 0
            entries = list(os.scandir(directory))
            children = []

            for entry in entries:
                if entry.is_file(follow_symlinks=False):
                    try:
                        immediate_size += entry.stat().st_size
                        file_count += 1
                    except (OSError, FileNotFoundError):
                        continue
                elif entry.is_dir():
                    children.append(crawl(entry.path, current_depth + 1))

            if children:
                logging.info(f"Found {len(children)} children for {directory}")
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
            csv_file.write(
                f"{node.path.absolute()},{node.size_gb():.6f},{node.total_size_gb():.6f},"
                f"{node.file_count},{node.total_file_count}\n"
            )

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

    return crawl(root_path, 0)


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


def main(
    root_path: str,
    crawl_depth: int,
    summary_depth: int,
    max_parallelism: int,
    output_file: str,
) -> None:
    results_file = output_file + ".csv"

    # Load cache from previous run
    cache = load_cache(results_file)
    # Backup existing results file
    if os.path.exists(results_file):
        os.rename(results_file, "." + results_file + ".bak")

    with open(results_file, mode="w") as f:
        f.write("path,immediate_size_gb,total_size_gb,immediate_files,total_files\n")

        logging.info("Building directory tree...")
        root = crawl_directory_tree(root_path, crawl_depth, max_parallelism, f, cache)

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

    main(
        args.root,
        args.crawl_depth,
        args.summary_depth,
        args.max_parallelism,
        args.output_file,
    )
