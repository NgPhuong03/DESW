import requests
import pandas as pd
import os
import numpy as np
from dotenv import load_dotenv

import chains.utils as utils

# Load environment variables from .env file
load_dotenv()


class Ethereum:
    URL = "https://api.dune.com/api/v1/query/3383110/results"

    @classmethod
    def get_validators(cls):
        print("Fetching data for Ethereum")

        api_key = os.getenv("DUNE_API_KEY")
        if not api_key:
            print("Error: DUNE_API_KEY is not set in the .env file")
            return None

        headers = {"X-Dune-API-Key": api_key}
        params = {"limit": 1000}

        response = requests.get(cls.URL, headers=headers, params=params)

        if response.status_code != 200:
            print(f"Unable to fetch data: {response.status_code}")
            return None

        response_data = response.json()
        rows = response_data.get("result", {}).get("rows", [])
        df = pd.DataFrame(rows)

        # Group by entity_just_name and sum amount_staked
        grouped_df = df.groupby("entity_just_name", as_index=False).agg(
            {"amount_staked": "sum"}
        )

        # Rename columns to standard format
        result_df = grouped_df.rename(
            columns={"entity_just_name": "address", "amount_staked": "tokens"}
        )

        # Convert tokens to integers
        result_df["tokens"] = (result_df["tokens"]).astype(int)

        # Filter out validators with tokens <= 0
        result_df = result_df[result_df["tokens"] > 0]

        # Sort by tokens in descending order
        sorted_df = result_df.sort_values(by="tokens", ascending=False)
        utils.write_csv(sorted_df, "ethereum")
        return sorted_df


if __name__ == "__main__":
    Ethereum.get_validators()
