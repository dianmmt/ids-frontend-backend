import joblib
import numpy as np
import pandas as pd

# Extract components
scaler = joblib.load('scaler.joblib')
model = joblib.load('random_forest_model.joblib')
label_encoder = joblib.load('label_encoder.joblib')

# Define columns to drop
useless_columns = ['Flow ID', 'Timestamp', 'Src IP', 'Dst IP', 'Src Port', 'Dst Port', 'Label']

def predict_single_row(data_row):
    """
    Predict the class for a single data row
    data_row: numpy array or list containing feature values
    """
    # Ensure data_row is a numpy array and has correct shape
    data_row = np.array(data_row).reshape(1, -1)
    
    # Apply scaling
    data_scaled = scaler.transform(data_row)
    
    # Get class prediction
    prediction = model.predict(data_scaled)  # trả về index label (sau khi encode)
    predicted_class = label_encoder.inverse_transform(prediction)[0]
    
    # Get probability distribution
    probabilities = model.predict_proba(data_scaled)[0]
    
    # Create probability dictionary
    prob_dict = {
        label_encoder.classes_[i]: float(prob) 
        for i, prob in enumerate(probabilities)
    }
    
    return predicted_class, prob_dict


# Example usage with a specific row from OVS.csv
if __name__ == "__main__":
    # Read test data from OVS.csv
    test_data = pd.read_csv('C:/Users/DELL/Desktop/NCKH/InSDN_DatasetCSV/metasploitable-2.csv')
    
    # Drop useless columns
    test_data_clean = test_data.drop(labels=useless_columns, axis='columns', errors='ignore')
    
    # Specify the row index (0-based indexing)
    specific_index = 2  # Change this to the desired row index (e.g., 5 for the 6th row)
    
    # Check if the index is valid
    if specific_index < 0 or specific_index >= len(test_data_clean):
        print(f"Error: Index {specific_index} is out of range. File has {len(test_data_clean)} rows.")
    else:
        # Get the specific row as numpy array
        specific_row = test_data_clean.iloc[specific_index].values
        
        print(f"\nPredicting for row {specific_index} from OVS.csv:")
        print(f"Selected row data:\n{test_data.iloc[specific_index]}")  # Print original row for reference
        predicted_class, probabilities = predict_single_row(specific_row)
        
        print(f"\nPredicted class: {predicted_class}")
        print(f"Probabilities:")
        for class_name, prob in probabilities.items():
            print(f"{class_name}: {prob:.4f}")