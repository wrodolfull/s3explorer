"""
Módulo para parsear nomes de arquivos de chamadas no formato:
2025/11/26/2025-11-26T21:29:19Z~2e067dd4-da80-4262-a1fb-76273b5a4bf7~551931999692~2B551931999692~920c51f2-4881-412a-86cc-fd041ec0f4c7.mp3

Ou para transcrições:
2025/11/26/2025-11-26T21:30:04Z~300977b1-c09c-44ea-b0dc-ca97949c27da.json
"""
import re
from datetime import datetime
from typing import Optional, Dict
from uuid import UUID


def parse_call_file_name(file_key: str) -> Optional[Dict]:
    """
    Parseia o nome do arquivo de chamada e extrai metadados
    
    Args:
        file_key: Nome completo do arquivo (ex: 2025/11/26/2025-11-26T21:29:19Z~uuid~num~leg~uuid.mp3)
        
    Returns:
        Dict com metadados parseados ou None se não for um arquivo de chamada
    """
    try:
        # Remove o caminho e pega apenas o nome do arquivo
        filename = file_key.split('/')[-1]
        
        # Verifica se tem o padrão de separador ~
        if '~' not in filename:
            return None
        
        parts = filename.split('~')
        
        # Padrão para arquivos de áudio: timestamp~call_uuid~phone~leg~file_uuid.ext
        # Padrão para transcrições: timestamp~file_uuid.json
        if len(parts) == 5:
            # Arquivo de áudio
            timestamp_str = parts[0]
            call_uuid = parts[1]
            phone_number = parts[2]
            leg = parts[3]
            file_uuid_with_ext = parts[4]
            
            # Extrai UUID e extensão
            file_uuid = file_uuid_with_ext.split('.')[0]
            extension = '.' + file_uuid_with_ext.split('.')[-1] if '.' in file_uuid_with_ext else ''
            
            # Extrai leg (A ou B)
            leg_letter = None
            if leg.startswith('2A') or leg.startswith('A'):
                leg_letter = 'A'
            elif leg.startswith('2B') or leg.startswith('B'):
                leg_letter = 'B'
            
            # Parse timestamp
            timestamp = None
            try:
                # Formato: 2025-11-26T21:29:19Z
                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ")
            except:
                pass
            
            # Extrai caminho da data
            date_path = '/'.join(file_key.split('/')[:-1]) if '/' in file_key else ''
            
            return {
                "file_type": "audio",
                "call_uuid": call_uuid,
                "file_uuid": file_uuid,
                "leg": leg_letter,
                "phone_number": phone_number,
                "timestamp": timestamp.isoformat() if timestamp else None,
                "date_path": date_path,
                "extension": extension
            }
        
        elif len(parts) == 2:
            # Arquivo de transcrição
            timestamp_str = parts[0]
            file_uuid_with_ext = parts[1]
            
            # Extrai UUID e extensão
            file_uuid = file_uuid_with_ext.split('.')[0]
            extension = '.' + file_uuid_with_ext.split('.')[-1] if '.' in file_uuid_with_ext else ''
            
            # Parse timestamp
            timestamp = None
            try:
                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%dT%H:%M:%SZ")
            except:
                pass
            
            # Extrai caminho da data
            date_path = '/'.join(file_key.split('/')[:-1]) if '/' in file_key else ''
            
            # Para transcrições, o file_uuid corresponde ao file_uuid do áudio
            # Precisamos buscar o call_uuid relacionado
            return {
                "file_type": "transcription",
                "call_uuid": None,  # Será preenchido ao relacionar com arquivo de áudio
                "file_uuid": file_uuid,
                "leg": None,
                "phone_number": None,
                "timestamp": timestamp.isoformat() if timestamp else None,
                "date_path": date_path,
                "extension": extension
            }
        
        return None
        
    except Exception as e:
        print(f"Erro ao parsear arquivo {file_key}: {str(e)}")
        return None


def is_call_file(file_key: str) -> bool:
    """
    Verifica se um arquivo segue o padrão de arquivo de chamada
    """
    return parse_call_file_name(file_key) is not None


def find_related_files(call_uuid: str, file_uuid: str, all_files: list) -> Dict:
    """
    Encontra arquivos relacionados (leg A, leg B, transcrições)
    
    Args:
        call_uuid: UUID da chamada
        file_uuid: UUID do arquivo atual
        all_files: Lista de todos os arquivos com metadados
        
    Returns:
        Dict com arquivos relacionados
    """
    related = {
        "leg_a": None,
        "leg_b": None,
        "transcription": None
    }
    
    for file in all_files:
        metadata = file.get("call_metadata")
        if not metadata:
            continue
        
        # Busca por call_uuid para áudios
        if metadata.get("file_type") == "audio" and metadata.get("call_uuid") == call_uuid:
            leg = metadata.get("leg")
            if leg == "A":
                related["leg_a"] = file
            elif leg == "B":
                related["leg_b"] = file
        
        # Busca por file_uuid para transcrições
        if metadata.get("file_type") == "transcription" and metadata.get("file_uuid") == file_uuid:
            related["transcription"] = file
    
    return related



