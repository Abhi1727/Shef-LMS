"""
MongoDB Atlas CSV Import Library for Google Colab
Supports string-based data insertion with validation and transformation
"""

import pandas as pd
import pymongo
import numpy as np
from datetime import datetime
import json
import logging
from typing import Dict, List, Optional, Callable, Any
import io
import requests
from urllib.parse import quote_plus

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MongoCSVImporter:
    """
    A comprehensive CSV to MongoDB Atlas importer with data validation and transformation
    """
    
    def __init__(
        self,
        cluster_url: str,
        username: str,
        password: str,
        database_name: str,
        collection_name: str,
        auth_source: str = "admin"
    ):
        """
        Initialize the MongoDB CSV Importer
        
        Args:
            cluster_url: MongoDB Atlas cluster URL (e.g., cluster0.xxxxx.mongodb.net)
            username: MongoDB username
            password: MongoDB password
            database_name: Target database name
            collection_name: Target collection name
            auth_source: Authentication source (default: admin)
        """
        self.cluster_url = cluster_url
        self.username = username
        self.password = password
        self.database_name = database_name
        self.collection_name = collection_name
        self.auth_source = auth_source
        
        # Connection and client
        self.client = None
        self.db = None
        self.collection = None
        
        # Statistics
        self.stats = {
            'total_rows': 0,
            'successful_imports': 0,
            'failed_imports': 0,
            'duplicates': 0,
            'errors': []
        }
        
    def connect(self):
        """Establish connection to MongoDB Atlas"""
        try:
            # Encode username and password for URL
            encoded_username = quote_plus(self.username)
            encoded_password = quote_plus(self.password)
            
            # Construct connection string
            connection_string = f"mongodb+srv://{encoded_username}:{encoded_password}@{self.cluster_url}/{self.database_name}?retryWrites=true&w=majority"
            
            # Connect to MongoDB
            self.client = pymongo.MongoClient(connection_string)
            self.db = self.client[self.database_name]
            self.collection = self.db[self.collection_name]
            
            # Test connection
            self.client.admin.command('ping')
            logger.info(f"✅ Successfully connected to MongoDB Atlas - Database: {self.database_name}, Collection: {self.collection_name}")
            
        except Exception as e:
            logger.error(f"❌ Connection failed: {str(e)}")
            raise
    
    def disconnect(self):
        """Close MongoDB connection"""
        if self.client:
            self.client.close()
            logger.info("🔌 Disconnected from MongoDB Atlas")
    
    def validate_csv_data(self, df: pd.DataFrame, required_columns: Optional[List[str]] = None) -> bool:
        """
        Validate CSV data structure and content
        
        Args:
            df: Pandas DataFrame containing CSV data
            required_columns: List of required column names
            
        Returns:
            bool: True if validation passes
        """
        if df.empty:
            logger.error("❌ CSV file is empty")
            return False
        
        # Check required columns
        if required_columns:
            missing_columns = [col for col in required_columns if col not in df.columns]
            if missing_columns:
                logger.error(f"❌ Missing required columns: {missing_columns}")
                return False
        
        # Check for completely empty columns
        empty_columns = [col for col in df.columns if df[col].isnull().all()]
        if empty_columns:
            logger.warning(f"⚠️ Warning: Empty columns found: {empty_columns}")
        
        logger.info(f"✅ CSV validation passed - Rows: {len(df)}, Columns: {len(df.columns)}")
        return True
    
    def transform_row(self, row: Dict[str, Any], transform_function: Optional[Callable] = None) -> Dict[str, Any]:
        """
        Transform a single row of data
        
        Args:
            row: Dictionary representing a row of data
            transform_function: Optional custom transformation function
            
        Returns:
            Dict: Transformed row data
        """
        if transform_function:
            try:
                return transform_function(row)
            except Exception as e:
                logger.error(f"❌ Transformation error for row: {str(e)}")
                return None
        
        # Default transformation
        transformed = {}
        for key, value in row.items():
            # Handle NaN values
            if pd.isna(value):
                transformed[key] = None
            # Handle string values
            elif isinstance(value, str):
                transformed[key] = value.strip() if value.strip() else None
            # Handle other types
            else:
                transformed[key] = value
        
        # Add metadata
        transformed['imported_at'] = datetime.now()
        transformed['import_source'] = 'csv_import'
        
        return transformed
    
    def check_duplicates(self, data: Dict[str, Any], unique_fields: List[str]) -> bool:
        """
        Check if data already exists based on unique fields
        
        Args:
            data: Data to check
            unique_fields: List of fields that should be unique
            
        Returns:
            bool: True if duplicate exists
        """
        try:
            query = {field: data.get(field) for field in unique_fields if data.get(field) is not None}
            if query:
                existing = self.collection.find_one(query)
                return existing is not None
        except Exception as e:
            logger.error(f"❌ Duplicate check error: {str(e)}")
        
        return False
    
    def import_from_string(
        self,
        csv_string: str,
        required_columns: Optional[List[str]] = None,
        unique_fields: Optional[List[str]] = None,
        transform_function: Optional[Callable] = None,
        batch_size: int = 1000,
        skip_duplicates: bool = True
    ) -> Dict[str, Any]:
        """
        Import data from CSV string
        
        Args:
            csv_string: CSV data as string
            required_columns: List of required column names
            unique_fields: List of fields to check for duplicates
            transform_function: Optional custom transformation function
            batch_size: Number of documents to insert in each batch
            skip_duplicates: Whether to skip duplicate records
            
        Returns:
            Dict: Import statistics
        """
        try:
            # Parse CSV string
            df = pd.read_csv(io.StringIO(csv_string))
            return self._import_dataframe(
                df=df,
                required_columns=required_columns,
                unique_fields=unique_fields,
                transform_function=transform_function,
                batch_size=batch_size,
                skip_duplicates=skip_duplicates
            )
            
        except Exception as e:
            logger.error(f"❌ CSV parsing error: {str(e)}")
            self.stats['errors'].append(f"CSV parsing error: {str(e)}")
            return self.stats
    
    def import_from_csv(
        self,
        csv_file_path: str,
        required_columns: Optional[List[str]] = None,
        unique_fields: Optional[List[str]] = None,
        transform_function: Optional[Callable] = None,
        batch_size: int = 1000,
        skip_duplicates: bool = True
    ) -> Dict[str, Any]:
        """
        Import data from CSV file
        
        Args:
            csv_file_path: Path to CSV file
            required_columns: List of required column names
            unique_fields: List of fields to check for duplicates
            transform_function: Optional custom transformation function
            batch_size: Number of documents to insert in each batch
            skip_duplicates: Whether to skip duplicate records
            
        Returns:
            Dict: Import statistics
        """
        try:
            # Read CSV file
            df = pd.read_csv(csv_file_path)
            return self._import_dataframe(
                df=df,
                required_columns=required_columns,
                unique_fields=unique_fields,
                transform_function=transform_function,
                batch_size=batch_size,
                skip_duplicates=skip_duplicates
            )
            
        except Exception as e:
            logger.error(f"❌ File reading error: {str(e)}")
            self.stats['errors'].append(f"File reading error: {str(e)}")
            return self.stats
    
    def _import_dataframe(
        self,
        df: pd.DataFrame,
        required_columns: Optional[List[str]] = None,
        unique_fields: Optional[List[str]] = None,
        transform_function: Optional[Callable] = None,
        batch_size: int = 1000,
        skip_duplicates: bool = True
    ) -> Dict[str, Any]:
        """
        Internal method to import DataFrame to MongoDB
        
        Args:
            df: Pandas DataFrame to import
            required_columns: List of required column names
            unique_fields: List of fields to check for duplicates
            transform_function: Optional custom transformation function
            batch_size: Number of documents to insert in each batch
            skip_duplicates: Whether to skip duplicate records
            
        Returns:
            Dict: Import statistics
        """
        # Reset statistics
        self.stats = {
            'total_rows': len(df),
            'successful_imports': 0,
            'failed_imports': 0,
            'duplicates': 0,
            'errors': []
        }
        
        # Validate data
        if not self.validate_csv_data(df, required_columns):
            return self.stats
        
        # Connect to database
        self.connect()
        
        try:
            # Convert DataFrame to list of dictionaries
            rows = df.to_dict('records')
            
            # Process in batches
            batch = []
            
            for i, row in enumerate(rows):
                try:
                    # Transform row
                    transformed_row = self.transform_row(row, transform_function)
                    
                    if transformed_row is None:
                        self.stats['failed_imports'] += 1
                        continue
                    
                    # Check for duplicates
                    if unique_fields and skip_duplicates:
                        if self.check_duplicates(transformed_row, unique_fields):
                            self.stats['duplicates'] += 1
                            logger.warning(f"⚠️ Duplicate found: {transformed_row}")
                            continue
                    
                    batch.append(transformed_row)
                    
                    # Insert batch when it reaches batch_size
                    if len(batch) >= batch_size:
                        self._insert_batch(batch)
                        batch = []
                    
                    # Progress logging
                    if (i + 1) % 100 == 0:
                        logger.info(f"📊 Processed {i + 1}/{len(rows)} rows...")
                
                except Exception as e:
                    self.stats['failed_imports'] += 1
                    self.stats['errors'].append(f"Row {i + 1}: {str(e)}")
                    logger.error(f"❌ Error processing row {i + 1}: {str(e)}")
            
            # Insert remaining rows
            if batch:
                self._insert_batch(batch)
            
            logger.info(f"✅ Import completed - Success: {self.stats['successful_imports']}, Failed: {self.stats['failed_imports']}, Duplicates: {self.stats['duplicates']}")
            
        finally:
            self.disconnect()
        
        return self.stats
    
    def _insert_batch(self, batch: List[Dict[str, Any]]):
        """
        Insert a batch of documents into MongoDB
        
        Args:
            batch: List of documents to insert
        """
        try:
            result = self.collection.insert_many(batch, ordered=False)
            self.stats['successful_imports'] += len(result.inserted_ids)
            logger.info(f"✅ Inserted batch of {len(result.inserted_ids)} documents")
            
        except pymongo.errors.BulkWriteError as e:
            # Handle partial insertions
            for error in e.details['writeErrors']:
                self.stats['failed_imports'] += 1
                self.stats['errors'].append(f"Bulk write error: {error['errmsg']}")
            
            successful_count = len(batch) - len(e.details['writeErrors'])
            self.stats['successful_imports'] += successful_count
            logger.warning(f"⚠️ Partial batch insert: {successful_count}/{len(batch)} successful")
            
        except Exception as e:
            self.stats['failed_imports'] += len(batch)
            self.stats['errors'].append(f"Batch insert error: {str(e)}")
            logger.error(f"❌ Batch insert error: {str(e)}")
    
    def get_import_statistics(self) -> Dict[str, Any]:
        """Get detailed import statistics"""
        return {
            **self.stats,
            'success_rate': (self.stats['successful_imports'] / self.stats['total_rows'] * 100) if self.stats['total_rows'] > 0 else 0,
            'database': self.database_name,
            'collection': self.collection_name,
            'timestamp': datetime.now().isoformat()
        }
    
    def clear_collection(self):
        """Clear all documents from the collection"""
        try:
            self.connect()
            result = self.collection.delete_many({})
            self.disconnect()
            logger.info(f"🗑️ Cleared collection: {result.deleted_count} documents deleted")
            return result.deleted_count
        except Exception as e:
            logger.error(f"❌ Error clearing collection: {str(e)}")
            raise
    
    def get_collection_count(self) -> int:
        """Get total document count in collection"""
        try:
            self.connect()
            count = self.collection.count_documents({})
            self.disconnect()
            return count
        except Exception as e:
            logger.error(f"❌ Error getting collection count: {str(e)}")
            return 0
