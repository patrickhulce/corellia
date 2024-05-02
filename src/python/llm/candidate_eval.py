import http.client
import json
import time
import typing
import urllib.request

import vertexai
from vertexai.generative_models import GenerativeModel, Image

PROJECT_ID = "patrick-hulce-personal"
LOCATION = "us-central1"
MODEL = "gemini-1.5-pro-preview-0409"

# Initialize Vertex AI
vertexai.init(project=PROJECT_ID, location=LOCATION)


def load_image_from_url(image_url: str) -> Image:
    with urllib.request.urlopen(image_url) as response:
        response = typing.cast(http.client.HTTPResponse, response)
        image_bytes = response.read()
    return Image.from_bytes(image_bytes)


def run_example():
    # Load images from Cloud Storage URI
    landmark1 = load_image_from_url(
        "https://storage.googleapis.com/cloud-samples-data/vertex-ai/llm/prompts/landmark1.png"
    )
    landmark2 = load_image_from_url(
        "https://storage.googleapis.com/cloud-samples-data/vertex-ai/llm/prompts/landmark2.png"
    )

    # Pass multimodal prompt
    model = GenerativeModel(model_name=MODEL)
    response = model.generate_content(
        [
            landmark1,
            "city: Rome, Landmark: the Colosseum",
            landmark2,
        ]
    )
    print(response)


def run_candidate_eval():
    RUBRIC_FILE = ".data/llm/rubric.txt"
    INPUT_FILE = ".data/llm/input.txt"
    OUT_FILE = ".data/llm/output.csv"

    def write_csv(rows):
        with open(OUT_FILE, "w") as f:
            f.write("candidate_email,overall_rating,dimension_ratings,explanation\n")
            for item in rows:
                email = item["candidate_email"]
                rating = item["overall_rating"]
                dimensions = ";".join([f"{k}={v}" for k, v in item["dimension_ratings"].items()])
                explanation = item["explanation"].replace('"', "")
                f.write(f'"{email}",{rating},"{dimensions}","{explanation}"\n')

    rubric = ""
    rows = []
    with open(RUBRIC_FILE, "r") as f:
        rubric = f.read()
    with open(INPUT_FILE, "r") as f:
        text = f.read()
        rows = [r.strip() for r in text.split(r"@@%%@@")]
        rows = [r for r in rows if r]

    # Group rows into chunks
    chunk_size = 10
    chunks = [rows[i : i + chunk_size] for i in range(0, len(rows), chunk_size)]
    chunks = [rows[i : i + chunk_size] for i in range(120, 180, chunk_size)]

    all_rows = []
    for i, chunk in enumerate(chunks[:]):
        # Pass multimodal prompt
        model = GenerativeModel(
            model_name=MODEL,
            generation_config={
                # "response_mime_type": "application/json",
                "temperature": 0.1,
            },
        )
        chunk_text = "\n\n".join(chunk)
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
        response = model.generate_content(
            f"""
            Your task is to evaluate candidates based on the following rubric:

            ```{rubric}```

            Here are the candidates:

            ```{chunk_text}```

            Reply with JSON array containing, for each candidate, your proposed rating (1-10) for each dimension of the rubric,
            and a brief explanation for each rating.

            Do NOT include any other output in your response that would make the response invalid JSON.

            {interface_text}
            """
        )
        if len(response.candidates) == 0:
            print(f"Error: No response for chunk #{i}")
            print(response)
            print(chunk_text)
            continue

        print(f"Content generated in {time.time() - start_time:.2f} seconds.")
        response_tokens = response.usage_metadata.candidates_token_count
        print(f"Response tokens for chunk #{i}: {response_tokens}")
        response_json = response.candidates[0].text.replace("```json", "", 1)
        response_json = response_json.replace("```", "", 1)
        if "```" in response_json:
            print(f"Error: Unexpected closing code block in response for chunk #{i}")
            print(response_json)
            continue

        try:
            items = json.loads(response_json)
            all_rows.extend(items)
        except json.JSONDecodeError as e:
            print(f"Error decoding JSON response for chunk #{i}: {e}")
            print(response_json)
        write_csv(all_rows)

    # Write output to file as CSV using appropriate headers, quoting, and escaping.
    write_csv(all_rows)


if __name__ == "__main__":
    run_candidate_eval()
