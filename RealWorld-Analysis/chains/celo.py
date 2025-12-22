import requests
import pandas as pd

import chains.utils as utils

class Celo:
    URL = 'https://thecelo.com/api/v0.1?method=groups'

    @classmethod
    def get_validators(cls):
        print('Fetching data for Celo')
        response = requests.get(cls.URL)

        if response.status_code != 200:
            print(f'Unable to fetch data: {response.status_code}')
            return None
        
        data = response.json()
        groups = data.get('groups', {})
        # Collect specified values for each group
        validator_info_list = [
            {
                'address': group[0],
                'tokens': float(group[1])
            }
            for address, group in groups.items()
        ]

        # # Create DataFrame
        df = pd.DataFrame(validator_info_list)

        # Filter out validators with tokens <= 0
        df = df[df['tokens'] > 0]

        # # Sort DataFrame by tokens
        sorted_df = df.sort_values(by='tokens', ascending=False)
        # Save DataFrame to CSV file
        utils.write_csv(sorted_df, 'celo')
        print(sorted_df)
        return sorted_df
    
if __name__ == '__main__':
    Celo.get_validators()
