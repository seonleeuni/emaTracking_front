import os
import zipfile
import pandas as pd
import xml.etree.ElementTree as ET
from datetime import datetime
import json
from typing import List

def extract_zip_file(zip_path: str, extract_to: str) -> tuple:
    """ZIP 파일을 UTF-8로 디코딩하여 압축 해제하고, .xml 파일 목록과 GPX 폴더 경로를 반환
       단, 'export_cda.xml' 파일은 무시한다.
       
    Returns:
        tuple: (xml_files_list, gpx_folder_path)
            - xml_files_list: ['내보내기.xml', '기타.xml', ...]
            - gpx_folder_path: GPX 파일이 있는 폴더 경로 (없으면 None)
    """
    os.makedirs(extract_to, exist_ok=True)
    
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # 파일명을 UTF-8로 변환
            for zip_info in zip_ref.infolist():
                zip_info.filename = zip_info.filename.encode('cp437').decode('utf-8', 'ignore')
                zip_ref.extract(zip_info, extract_to)

    xml_files_list = []
    gpx_folder_path = None

    for file in os.listdir(extract_to):
        file_path = os.path.join(extract_to, file)
        
        # ✅ .xml 파일 중 "export_cda.xml"은 무시하고 나머지 사용
        if file.endswith(".xml") and file != "export_cda.xml":
            xml_files_list.append(file_path)  # 사용 가능한 XML 파일 목록 추가
        elif os.path.isdir(file_path):  # GPX 폴더 찾기
            gpx_folder_path = file_path

    # 🚨 XML 파일이 하나도 없으면 오류 발생
    if not xml_files_list:
        raise FileNotFoundError("🚨 'export_cda.xml'을 제외한 .xml 파일을 찾을 수 없습니다.")

    return xml_files_list[0], gpx_folder_path

def process_ios_health_xml(xml_file_path: str, start_date: datetime, end_date: datetime) -> pd.DataFrame:
    """iOS Health '내보내기.xml'을 읽어 데이터프레임으로 변환 및 날짜 필터링"""
    tree = ET.parse(xml_file_path)
    root = tree.getroot()
    
    records = [child.attrib for child in root if child.tag == "Record"]
    ios_health_df = pd.DataFrame(records)

    if ios_health_df.empty:
        return ios_health_df  # 빈 데이터프레임 반환

    ios_health_df['creationDate'] = pd.to_datetime(ios_health_df['creationDate'], format='%Y-%m-%d %H:%M:%S %z')
    tz_info = ios_health_df['creationDate'].iloc[0].tzinfo

    start_date_tz = start_date.replace(tzinfo=tz_info)
    end_date_tz = end_date.replace(tzinfo=tz_info)

    return ios_health_df[
        (ios_health_df['creationDate'] >= start_date_tz) & 
        (ios_health_df['creationDate'] <= end_date_tz)
    ]

def process_gpx_files(gpx_folder_path: str, start_date: datetime, end_date: datetime) -> pd.DataFrame:
    """GPX 파일을 읽어 데이터프레임으로 변환 및 날짜 필터링
    - 파일명에서 날짜(YYYY-MM-DD)를 추출하여 start_date ~ end_date 내의 GPX 파일만 읽음
    - 모든 GPX 데이터를 하나의 데이터프레임으로 합침
    """

    if gpx_folder_path is None:
        return pd.DataFrame()  # GPX 데이터가 없는 경우 빈 데이터프레임 반환

    all_points = []
    
    # 📌 GPX 폴더 내 파일 목록 가져오기
    gpx_files = [f for f in os.listdir(gpx_folder_path) if f.endswith('.gpx')]

    # 📌 파일명을 기준으로 날짜 필터링
    for gpx_file in gpx_files:
        try:
            # 파일명에서 날짜 추출 (예: 'route_2022-04-07_6.19pm.gpx' → '2022-04-07')
            file_date_str = gpx_file.split('_')[1]  # 두 번째 요소가 날짜
            file_date = datetime.strptime(file_date_str, "%Y-%m-%d")
        except (IndexError, ValueError):
            print(f"⚠️ 날짜 형식을 추출할 수 없는 GPX 파일: {gpx_file}")
            continue

            # 날짜가 지정한 범위 내에 있는 경우만 처리
            if start_date <= file_date <= end_date:
                gpx_path = os.path.join(gpx_folder_path, gpx_file)
                print(f"📌 Processing GPX file: {gpx_path}")

                # .gpx 파일 파싱
                tree = ET.parse(gpx_path)
                root = tree.getroot()
                ns = {"gpx": "http://www.topografix.com/GPX/1/1"}  # GPX 네임스페이스 정의

                # GPX 데이터 읽기
                for trk in root.findall("gpx:trk", ns):
                    for trkseg in trk.findall("gpx:trkseg", ns):
                        for trkpt in trkseg.findall("gpx:trkpt", ns):
                            lat = trkpt.attrib.get("lat")
                            lon = trkpt.attrib.get("lon")
                            ele = trkpt.find("gpx:ele", ns)
                            time = trkpt.find("gpx:time", ns)

                            if time is not None:
                                time_parsed = datetime.strptime(time.text, "%Y-%m-%dT%H:%M:%SZ")

                                all_points.append({
                                    "File": gpx_file,
                                    "Latitude": lat,
                                    "Longitude": lon,
                                    "Elevation": ele.text if ele is not None else None,
                                    "Time": time_parsed
                                })

        except Exception as e:
            print(f"⚠️ GPX 파일 처리 오류 ({gpx_file}): {e}")
            continue

    # 📌 모든 데이터를 하나의 데이터프레임으로 변환
    ios_gps_df = pd.DataFrame(all_points)

    return ios_gps_df

def merge_health_and_gps(ios_health_df: pd.DataFrame, ios_gps_df: pd.DataFrame, research_name: str, participant_id: str) -> pd.DataFrame:
    """iOS Health 데이터와 GPX 데이터를 시간 기준으로 합집합(outer join) 방식으로 병합"""

    # 데이터프레임이 둘 다 비어있으면 빈 데이터프레임 반환
    if ios_health_df.empty and ios_gps_df.empty:
        return pd.DataFrame()

    # ✅ 1. iOS Health 데이터 정리
    if not ios_health_df.empty:
        ios_health_df = ios_health_df.rename(columns={"creationDate": "timeStamp"})  # 시간 컬럼명 변경
        ios_health_df. loc[:,"research_name"] = research_name
        ios_health_df.loc[:,"pID"] = participant_id
        ios_health_df["column"] = ios_health_df["type"].str.replace('HKQuantityTypeIdentifier', '', regex=False).str.strip()
        ios_health_df = ios_health_df[["research_name", "pID", "timeStamp", "value", "column"]]
    else:
        ios_health_df = pd.DataFrame(columns=["research_name", "pID", "timeStamp", "value", "column"])

    # ✅ 2. GPX 데이터 정리
    if not ios_gps_df.empty:
        ios_gps_df.loc[:,"research_name"] = research_name
        ios_gps_df.loc[:,"pID"] = participant_id
        ios_gps_df["timeStamp"] = ios_gps_df["Time"]
        ios_gps_df["value"] = ios_gps_df.apply(
            lambda row: f"({row['Latitude']}, {row['Longitude']}, {row['Elevation']})", axis=1
        )
        ios_gps_df["column"] = "latitude, longitude, elevation"
        ios_gps_df = ios_gps_df[["research_name", "pID", "timeStamp", "value", "column"]]
    else:
        ios_gps_df = pd.DataFrame(columns=["research_name", "pID", "timeStamp", "value", "column"])

    # ✅ 3. 시간 기준으로 합집합 병합 (NaN 처리 포함)
    merged_df = pd.concat([ios_health_df, ios_gps_df], ignore_index=True, sort=False)

    # ✅ 4. 인덱스 초기화
    merged_df = merged_df.reset_index(drop=True)

    return merged_df

def ios_read_zip(zip_path: str, extract_to: str, start_date: str, end_date: str, research_name: str, participant_id: str) -> pd.DataFrame:
    """
    ZIP 파일을 압축 해제하고, iOS Health 및 GPX 데이터를 읽어 하나의 데이터프레임으로 변환

    Args:
        zip_path (str): ZIP 파일 경로
        extract_to (str): 압축을 풀 대상 폴더명
        start_date (str): 데이터 필터링 시작 날짜 (예: "2024-02-01")
        end_date (str): 데이터 필터링 종료 날짜 (예: "2024-02-10")
        research_name (str): 연구명
        participant_id (str): 참가자 ID (pID)

    Returns:
        pd.DataFrame: iOS Health 데이터와 GPX 데이터를 병합한 단일 데이터프레임
    """
    start_date_dt = datetime.strptime(start_date, "%Y-%m-%d")
    end_date_dt = datetime.strptime(end_date, "%Y-%m-%d")

    xml_file_path, gpx_folder_path = extract_zip_file(zip_path, extract_to)

    ios_health_df = process_ios_health_xml(xml_file_path, start_date_dt, end_date_dt)
    ios_gps_df = process_gpx_files(gpx_folder_path, start_date_dt, end_date_dt)
    merged_df = merge_health_and_gps(ios_health_df, ios_gps_df, research_name, participant_id)

    return merged_df

def convert_ios_df_to_json(ios_df: pd.DataFrame, variables: List[str], output_file: str = None) -> str:
    """
    iOS 데이터프레임을 JSON으로 변환하는 함수 (특정 column 값들을 가진 행만 선택 가능).

    Args:
        ios_df (pd.DataFrame): 변환할 iOS 데이터프레임
        variables (List[str]): 특정 'column' 값들의 리스트 (예: ["Heart Rate", "Steps", "latitude, longitude, elevation"])
        output_file (str, optional): JSON 파일로 저장할 경우 지정할 파일 경로 (예: 'output.json')

    Returns:
        str: JSON 형식의 문자열 (파일 저장을 선택한 경우에도 반환됨)
    """
    # 여러 개의 column 값을 포함하는 행만 필터링
    filtered_df = ios_df[ios_df["column"].isin(variables)]
    
    # 데이터프레임이 비어 있으면 경고 메시지 출력
    if filtered_df.empty:
        print(f"⚠️ {variables}에 해당하는 데이터가 없습니다.")
        return "[]"
    
    # 데이터프레임을 JSON 형식으로 변환
    json_data = filtered_df.to_json(orient="records", indent=4, force_ascii=False)

    # JSON 파일로 저장 (옵션)
    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(json_data)
        print(f"📂 JSON 파일 저장 완료: {output_file}")

    return json_data


# 사용 예시
zip_file_path = r"C:\Users\rlagy\Desktop\2025\phenotype_웹앱\ios_data.zip"  # 압축 파일 경로 (실제 경로로 변경)
extract_folder = r"C:\Users\rlagy\Desktop\2025\phenotype_웹앱\export_ios_data"  # 압축 해제할 폴더명
start_date = "2025-01-18"
end_date = "2025-01-21"
research_name="My_Research",
participant_id="P12345"
variables=["StepCount"]
ios_df = ios_read_zip(zip_file_path, extract_folder, start_date, end_date, research_name, participant_id) # zip 압축해제 및 파일 읽기
json_output = convert_ios_df_to_json(ios_df, variables, output_file=r"C:\Users\rlagy\Desktop\2025\phenotype_웹앱\ios_data.json") # JSON 변환 및 파일 저장
