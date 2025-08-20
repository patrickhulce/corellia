import csv
import getpass
import json
import os
import time
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_deepseek import ChatDeepSeek

# Set API key if not already set
if not os.getenv("DEEPSEEK_API_KEY"):
    os.environ["DEEPSEEK_API_KEY"] = getpass.getpass("Enter your DeepSeek API key: ")

MODEL = "deepseek-reasoner"  # Using DeepSeek's chat model


def run_candidate_eval():
    RUBRIC_FILE = ".data/llm/rubric.txt"
    INPUT_FILE = ".data/llm/input.csv"
    OUT_FILE = ".data/llm/output.csv"
    LIMIT = 600

    all_rows = []
    processed_emails = set()
    if os.path.exists(OUT_FILE):
        with open(OUT_FILE, "r") as f:
            reader = csv.DictReader(f)
            all_rows = [row for row in reader]
            processed_emails = set(row["candidate_email"] for row in reader)

    def write_csv(rows: list[dict[str, Any]]):
        flattened_rows: list[dict[str, Any]] = []
        for row in rows:
            flattened_rows.append(
                {
                    "candidate_email": row["candidate_email"],
                    "overall_rating": row["overall_rating"],
                    **{
                        f"dimension_{k}": v for k, v in row["dimension_ratings"].items()
                    },
                    "explanation": row["explanation"],
                }
            )

        with open(OUT_FILE, "w") as f:
            writer = csv.DictWriter(f, fieldnames=flattened_rows[0].keys())
            writer.writeheader()
            writer.writerows(flattened_rows)

    rubric = ""
    rows: list[dict[str, Any]] = []
    with open(RUBRIC_FILE, "r") as f:
        rubric = f.read()
    with open(INPUT_FILE, "r") as f:
        csv_reader = csv.DictReader(f)
        rows = [row for row in csv_reader][:LIMIT]
        for row in rows:
            name = f"{row['First Name']} {row['Last Name']}"
            email = row["Email Address"] or ""
            row["text"] = f"""
{name} <{email}>
Annual Household Income: {row["Annual Household Income"]}
High School GPA (4.0 Scale): {row["High School GPA (4.0 Scale)"]}
College GPA (4.0 Scale): {row["College GPA (4.0 Scale)"]}
Immigrant Identity: {row["Immigrant Identity"]}
SAT Score: {row["SAT Score"]}
ACT Score: {row["ACT Score"]}
Personal Statement: {row["Personal Statement"]}
            """.strip()

    # Filter out rows we've already evaluated
    print(f"Found {len(rows)} total rows.")
    print(f"Found {len(processed_emails)} rows already processed.")
    rows = [row for row in rows if row["Email Address"] not in processed_emails]
    print(f"Found {len(rows)} rows to evaluate.")

    # Group rows into chunks
    chunk_size = 10
    chunks = [rows[i : i + chunk_size] for i in range(0, len(rows), chunk_size)]

    # Initialize the DeepSeek model
    model = ChatDeepSeek(
        model=MODEL,
        temperature=0.1,
        max_tokens=None,
    )

    for i, chunk in enumerate(chunks[:]):
        chunk_text = "\n\n---\n\n".join([row["text"] for row in chunk])
        interface_text = """
        interface ResponseItem {
            /** The email of the candidate. */
            candidate_email: string;
            /** The proposed overall rating (1-10) for the candidate. */
            overall_rating: number;
            /** The proposed ratings (1-10) for each dimension of the rubric. */
            dimension_ratings: {
                [dimension: string]: number;
            }
            /** A _brief_ explanation for the decision. */
            explanation: string;
        }
        """
        print(f"Generating content for chunk #{i}...")
        start_time = time.time()

        # Create the prompt for DeepSeek
        system_prompt = "You are an expert candidate evaluator. You will provide structured JSON output only."
        human_prompt = f"""
            Your task is to evaluate candidates based on the following rubric:

            ```{rubric}```

            Here are the candidates:

            ```{chunk_text}```

            Reply with JSON array containing, for each candidate, your proposed rating (1-10) for each dimension of the rubric,
            and a brief explanation for each rating.

            Do NOT include any other output in your response that would make the response invalid JSON.

            {interface_text}
            """

        # Invoke the model
        response = model.invoke(
            [SystemMessage(content=system_prompt), HumanMessage(content=human_prompt)]
        )

        print(f"Content generated in {time.time() - start_time:.2f} seconds.")

        # Process the response
        assert isinstance(response.content, str)
        response_text = response.content

        # Clean up the response to extract JSON
        if "```json" in response_text:
            response_json = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_json = response_text.split("```")[1].split("```")[0].strip()
        else:
            response_json = response_text.strip()

        try:
            items = json.loads(response_json)
            for item in items:
                assert isinstance(item, dict)
                assert "candidate_email" in item
                assert "overall_rating" in item
                assert "dimension_ratings" in item
                assert "explanation" in item

                assert isinstance(item["candidate_email"], str)
                candidate_email = (
                    item["candidate_email"].removeprefix("<").removesuffix(">")
                )
                item["candidate_email"] = candidate_email

            all_rows.extend(items)
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON response for chunk #{i}: {e}")
            print(response_json)
        except AssertionError as e:
            print(f"Error validating JSON response for chunk #{i}: {e}")
            print(response_json)
        write_csv(all_rows)

    # Write output to file as CSV using appropriate headers, quoting, and escaping.
    write_csv(all_rows)


if __name__ == "__main__":
    run_candidate_eval()
