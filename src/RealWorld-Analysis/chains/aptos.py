import http.client
import json
import requests
import pandas as pd

import chains.utils as utils


class Aptos:
    MAINNET_VALIDATORS_DATA_URL = "https://storage.googleapis.com/aptos-mainnet/explorer/validator_stats_v2.json?cache-version=0"
    MAINNET_FULLNODE_DATA_URL = "fullnode.mainnet.aptoslabs.com"

    @classmethod
    def get_validators(cls):
        print("Fetching data for Aptos")
        response = requests.get(cls.MAINNET_VALIDATORS_DATA_URL)

        if response.status_code != 200:
            print(f"Unable to fetch data: {response.status_code}")
            return None

        validators_data = response.json()

        validator_info_list = []
        for index, validator in enumerate(validators_data, start=1):
            address = validator.get("owner_address", "Unknown")
            tokens = cls.get_tokens(address)
            # Only add validators with valid tokens (> 0)
            if tokens is not None and tokens > 0:
                validator_info_list.append({"address": address, "tokens": tokens})
            # Skip validators with invalid/missing data (silently)

        if not validator_info_list:
            print("No valid validators found")
            return None

        df = pd.DataFrame(validator_info_list)
        sorted_df = df.sort_values(by="tokens", ascending=False)
        utils.write_csv(sorted_df, "aptos")
        return sorted_df

    @classmethod
    def get_tokens(cls, address):
        conn = http.client.HTTPSConnection(cls.MAINNET_FULLNODE_DATA_URL)
        headers = {"Accept": "application/json"}
        request_path = f"/v1/accounts/{address}/resource/0x1::stake::StakePool"
        try:
            conn.request("GET", request_path, headers=headers)
            res = conn.getresponse()

            if res.status != 200:
                # API returned error, return None instead of raising exception
                return None

            data = res.read().decode("utf-8")
            json_object = json.loads(data)

            # Check if keys exist before access to avoid KeyError
            # Return None if keys are missing (validator will be skipped)
            active_value = json_object.get("data", {}).get("active", {}).get("value")
            if active_value is not None:
                return int(active_value)
            else:
                # Missing required keys, return None (will be filtered out)
                return None
        except (KeyError, ValueError, json.JSONDecodeError) as e:
            # Handle any parsing errors gracefully
            return None
        finally:
            conn.close()


if __name__ == "__main__":
    Aptos.get_validators()
