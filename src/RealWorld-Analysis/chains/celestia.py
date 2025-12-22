import requests
import pandas as pd
import chains.utils as utils

class Celestia:
    URL = 'https://celestia.api.explorers.guru/api/v1/validators'
    
    @classmethod
    def get_validators(cls):
        print('Fetching data for Celestia')
        response = requests.get(cls.URL)
        
        if response.status_code == 200:
            data = response.json()
            # Process each validator's data
            validator_info_list = [
                {
                    'address': validator.get('moniker', None),
                    'tokens': int(validator.get('tokens', 0.0))
                }
                for validator in data
            ]
            # Create DataFrame
            df = pd.DataFrame(validator_info_list)
            
            # Filter out validators with tokens <= 0
            df = df[df['tokens'] > 0]
            
            # Sort DataFrame by tokens
            sorted_df = df.sort_values(by='tokens', ascending=False)
            
            utils.write_csv(sorted_df, 'celestia')

            return sorted_df
        else:
            print(f'Unable to fetch data: {response.status_code}')
            return None

if __name__ == '__main__':
    validator_dataframe = Celestia.get_validators()
    print(validator_dataframe)