import asyncio
import json
import os
import re

from browser_use import Agent, Browser, BrowserConfig, Controller
from browser_use.browser.context import BrowserContext
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, SecretStr

_ = load_dotenv()

CWD = os.getcwd()


class PurchasedItem(BaseModel):
    name: str
    price: float
    quantity: int


class TransactionRef(BaseModel):
    details_url: str
    total_price: float
    date: str
    id: str | None = None


class Transaction(TransactionRef):
    items: list[PurchasedItem]

    subtotal_price: float | None = None
    tax_price: float | None = None
    shipping_price: float | None = None
    payment_method: str | None = None
    store_location: str | None = None


class TransactionRefList(BaseModel):
    transaction_refs: list[TransactionRef]


class TransactionList(BaseModel):
    transactions: list[Transaction]


async def get_transaction_refs(
    browser_context: BrowserContext, llm: ChatOpenAI, start_date: str
) -> list[TransactionRef]:
    """Extract all purchase references since the given date."""
    if os.path.exists(".data/transaction_refs.json"):
        with open(".data/transaction_refs.json", "r") as f:
            return TransactionRefList.model_validate_json(json.load(f)).transaction_refs

    transaction_refs_task = f"""
    Navigate to the in-store order history.
    Extract all transactions since {start_date}, loading more pages as necessary, and return them as a JSON list matching this format:
    {{
        "transaction_refs": [
            {{
                "details_url": "https://www.example.com/orders/1234567890",
                "total_price": 123.45,
                "date": "YYYY-MM-DD",
                "id": "optional order ID"
            }}
        ]
    }}
    """

    controller: Controller[TransactionRefList] = Controller(
        output_model=TransactionRefList
    )

    refs_agent = Agent(
        task=transaction_refs_task,
        initial_actions=[
            {"open_tab": {"url": "https://www.target.com/orders"}},
        ],
        llm=llm,
        browser_context=browser_context,
        controller=controller,
        save_conversation_path=os.path.join(CWD, ".data/logs"),
    )

    print("Running transaction refs agent")
    history = await refs_agent.run()
    result = history.final_result()
    print("Transaction refs agent complete", result)
    if result is None:
        raise ValueError("No result found")
    parsed = TransactionRefList.model_validate_json(result)
    with open(".data/transaction_refs.json", "w") as f:
        json.dump(parsed.model_dump(), f)
    return parsed.transaction_refs


async def get_transaction_details(
    browser_context: BrowserContext, llm: ChatOpenAI, transaction_ref: TransactionRef
) -> Transaction:
    """Extract detailed item information for a specific purchase."""
    pseudo_id = re.sub(
        r"[^a-zA-Z0-9]",
        "-",
        f"unknown-{transaction_ref.date}-{transaction_ref.total_price}",
    )
    transaction_id = transaction_ref.id or pseudo_id

    if os.path.exists(f".data/transactions/{transaction_id}.json"):
        with open(f".data/transactions/{transaction_id}.json", "r") as f:
            return Transaction.model_validate_json(json.load(f))

    details_task = f"""
    Navigate to this transaction details URL: {transaction_ref.details_url}
    Extract all details from this transaction and return them in this JSON format:
    {{
        "subtotal_price": 12.34,
        "tax_price": 1.23,
        "shipping_price": 2.34,
        "payment_method": "Visa *1234",
        "store_location": "123 Main St, Anytown, TX USA",
        "items": [
            {{
                "name": "item name",
                "price": 12.34,
                "quantity": 1
            }}
        ]
    }}
    """

    controller: Controller[Transaction] = Controller(output_model=Transaction)

    details_agent = Agent(
        task=details_task,
        llm=llm,
        browser_context=browser_context,
        controller=controller,
    )

    history = await details_agent.run()
    result = history.final_result()
    if result is None:
        raise ValueError("No result found")
    partial_data = json.loads(result)
    transaction = Transaction.model_validate(
        {**transaction_ref.model_dump(), **partial_data}
    )

    with open(f".data/transactions/{transaction_id}.json", "w") as f:
        json.dump(transaction.model_dump(), f)

    return transaction


async def main():
    # Initialize the browser
    current_directory = os.getcwd()
    user_data_dir = os.path.join(current_directory, ".data/chrome/")
    os.makedirs(user_data_dir, exist_ok=True)

    browser = Browser(
        config=BrowserConfig(
            chrome_instance_path="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            extra_chromium_args=[f"--user-data-dir={user_data_dir}"],
        )
    )

    # Initialize the LLM
    api_key = os.environ.get("OPENAI_API_KEY", "your_api_key_here")
    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0,
        api_key=SecretStr(api_key),
    )

    start_date = "2024-01-01"  # Adjust as needed

    async with await browser.new_context() as context:
        assert isinstance(context, BrowserContext)

        # Step 1: Get all transaction references
        transaction_refs = await get_transaction_refs(context, llm, start_date)

        # Step 2: Get details for each transaction
        transactions: list[Transaction] = []
        for ref in transaction_refs:
            transaction = await get_transaction_details(context, llm, ref)
            transactions.append(transaction)

        # Create final result
        result = TransactionList(transactions=transactions)

        # Print or process the results
        for transaction in result.transactions:
            print(
                f"\nTransaction on {transaction.date} - Total: ${transaction.total_price:.2f}"
            )
            for item in transaction.items:
                print(f"  - {item.name}: ${item.price:.2f}")

    await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
