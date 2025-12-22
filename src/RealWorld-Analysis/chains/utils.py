from datetime import datetime
import pandas as pd
import socket
import os

def write_csv(df, network):
    # Get current date
    current_date = datetime.now().strftime('%d%m%Y')
    
    # Get this script's directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Go up one level to the main directory
    destake_dir = os.path.dirname(script_dir)
    # Build data directory path
    data_test_dir = os.path.join(destake_dir, 'data')
    
    # Create directory if it does not exist
    os.makedirs(data_test_dir, exist_ok=True)
    
    # Append date to file name
    csv_file = os.path.join(data_test_dir, f'{current_date}_{network}.csv')
    
    # Write DataFrame to CSV file
    df.to_csv(csv_file, index=False)
    print(f'Data has been written to {csv_file}')

def get_ip_address(domain):
    try:
        ip_address = socket.gethostbyname(domain)
        return ip_address
    except Exception as e:
        return str(e)