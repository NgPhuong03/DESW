import importlib
import sys
from datetime import datetime

def main(blockchains):
    # Main function to fetch validator data for multiple blockchains

    print(f"Starting analysis for {len(blockchains)} blockchains...")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    results = {}
    failed_chains = []
    
    for i, blockchain in enumerate(blockchains, 1):
        print(f"\n[{i}/{len(blockchains)}] Processing {blockchain.upper()}...")
        print("-" * 40)
        
        try:
            # Dynamically import module based on blockchain name
            module_name = f'chains.{blockchain}'
            module = importlib.import_module(module_name)
            
            # Assume class name matches blockchain with the first letter capitalized
            class_name = blockchain.capitalize()
            blockchain_class = getattr(module, class_name, None)
            
            if blockchain_class is None:
                print(f"Class {class_name} not found in {module_name}")
                failed_chains.append(blockchain)
                continue
            
            # Call get_validators method
            print(f"Fetching validators data...")
            validators = blockchain_class.get_validators()
            
            if validators is not None:
                print(f"Completed {blockchain.upper()}: {len(validators)} validators")
                results[blockchain] = validators
            else:
                print(f"Unable to fetch validators data for {blockchain}")
                failed_chains.append(blockchain)
                
        except ImportError as e:
            print(f"Unable to import module {module_name}: {e}")
            failed_chains.append(blockchain)
        except Exception as e:
            print(f"Error processing {blockchain}: {e}")
            failed_chains.append(blockchain)
    

    
    if failed_chains:
        print(f"\nFailed ({len(failed_chains)} blockchains):")
        for blockchain in failed_chains:
            print(f" {blockchain.upper()}")
    
    
    return results

if __name__ == '__main__':

    blockchains = [
        'ethereum', 'aptos', 'axelar', 'celestia', 
        'celo', 'injective', 'polygon', 'sui'
    ]
    
    main(blockchains)