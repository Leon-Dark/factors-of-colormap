from flask import Flask, request, jsonify
import json
from datetime import datetime
import os
import csv
from flask_cors import CORS
import logging
import threading
import random

app = Flask(__name__)

# 配置日志
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Ensure the data directory exists
DATA_DIR = "data"
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# 用于分配 subjectid 的线程锁
LOCK = threading.Lock()

###########################################################################
# 0) 定义所有 colormap 以及生成分配表的函数
###########################################################################

ALL_COLORMAPS = [
    "Hue-7 with Wave-0", "Hue-7 with Wave-1", "Hue-7 with Wave-2", "Hue-7 with Wave-3", "Hue-7 with Wave-4",
    "Hue-7 with Wave-5", "Hue-7 with Wave-6", "Hue-7 with Wave-7", "Hue-7 with Wave-8", "Hue-7 with Wave-9",
    "Hue-5 with Wave-0", "Hue-5 with Wave-1", "Hue-5 with Wave-2", "Hue-5 with Wave-3", "Hue-5 with Wave-4",
    "Hue-5 with Wave-5", "Hue-5 with Wave-6", "Hue-5 with Wave-7", "Hue-5 with Wave-8", "Hue-5 with Wave-9",
    "Hue-3 with Wave-0", "Hue-3 with Wave-1", "Hue-3 with Wave-2", "Hue-3 with Wave-3", "Hue-3 with Wave-4",
    "Hue-3 with Wave-5", "Hue-3 with Wave-6", "Hue-3 with Wave-7", "Hue-3 with Wave-8", "Hue-3 with Wave-9",
]

# 全局变量，用来存储对于每个 subjectid 分配到的 colormap
# ASSIGNMENTS[i] 为第 i 个被试对应的 6 个 colormap
ASSIGNMENTS = [None] * 30  # 被试编号 0~29

def generate_assignments():
    """
    生成一份“每位被试应该分到哪些 colormap”的分配表。
    思路：
      1) 将 ALL_COLORMAPS 按 "Hue" 值（Hue-7, Hue-5, Hue-3）分成三组
      2) 对于每组，每个 colormap 重复6次（总共60个位置），打乱后每两项组成一对
      3) 对于30个被试，每人从每组各取2个 colormap，合并后再打乱顺序
    保证：
      - 每位被试得到3种不同“Hue”值的 colormap，各出现2次
      - 每个 colormap 总共被分配6次
    """
    # 可以设置固定种子以保证每次启动分配都一致
    # random.seed(1234)
    
    # 分组
    hue7_colormaps = ALL_COLORMAPS[0:10]    # Hue-7 with Wave-0 ~ Wave-9
    hue5_colormaps = ALL_COLORMAPS[10:20]   # Hue-5 with Wave-0 ~ Wave-9
    hue3_colormaps = ALL_COLORMAPS[20:30]   # Hue-3 with Wave-0 ~ Wave-9

    # 创建分组分配计划，每个 colormap 重复6次，然后打乱并分为30对
    def create_group_assignments(group_colormaps):
        assignments = []
        for cmap in group_colormaps:
            assignments.extend([cmap] * 6)
        random.shuffle(assignments)
        grouped_assignments = [assignments[i:i+2] for i in range(0, 60, 2)]
        return grouped_assignments

    hue7_assignments = create_group_assignments(hue7_colormaps)
    hue5_assignments = create_group_assignments(hue5_colormaps)
    hue3_assignments = create_group_assignments(hue3_colormaps)

    for i in range(30):
        # 每组取出2个，合并成6个，再打乱顺序
        colormaps_for_i = hue7_assignments[i] + hue5_assignments[i] + hue3_assignments[i]
        random.shuffle(colormaps_for_i)
        ASSIGNMENTS[i] = colormaps_for_i

# 启动时生成分配表
generate_assignments()

###########################################################################
# 新的分配记录加载和保存函数，使用 assignments.json 来记录每个 subjectid 的分配情况
###########################################################################
def load_assignments_file():
    json_path = os.path.join(DATA_DIR, "assignments.json")
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            assignments_dict = json.load(f)
    else:
        assignments_dict = {}
    return assignments_dict

def save_assignments_file(assignments_dict):
    json_path = os.path.join(DATA_DIR, "assignments.json")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(assignments_dict, f, indent=2, ensure_ascii=False)

###########################################################################
# 1) 路由 /get_subject_id —— 分配唯一 subjectid (0~29) + 返回对应 colormap
###########################################################################
@app.route('/get_subject_id', methods=['GET'])
def get_subject_id():
    with LOCK:
        assignments_dict = load_assignments_file()
        subject_id = None
        # 遍历 0~29，找到尚未分配的 id
        for i in range(30):
            if str(i) not in assignments_dict:
                subject_id = i
                break

        if subject_id is None:
            return jsonify({
                "status": "error",
                "message": "All 30 IDs have been assigned!"
            }), 400

        # 将分配记录写入字典，注意：ASSIGNMENTS 在服务启动时已固定生成
        assignments_dict[str(subject_id)] = ASSIGNMENTS[subject_id]
        save_assignments_file(assignments_dict)

        return jsonify({
            "status": "success",
            "subjectid": subject_id,
            "colormaps": ASSIGNMENTS[subject_id]
        })

###########################################################################
# 2) 保存实验数据到 CSV
###########################################################################
def save_to_csv(data, filepath):
    try:
        if not isinstance(data, dict):
            logger.error(f"Invalid data format. Expected dict, got {type(data)}")
            return False

        experimental_data = data.get('experimentalData', [])
        if not isinstance(experimental_data, list):
            experimental_data = [experimental_data]

        csv_data = []
        for item in experimental_data:
            row = {
                'trialNum': data.get('trialNum', ''),
                'stimulusCorrect': data.get('stimulusCorrect', 0),
                'engagementCorrect': data.get('engagementCorrect', 0),
            }
            if isinstance(item, dict):
                row.update(item)
            csv_data.append(row)

        fieldnames = sorted({key for item in csv_data for key in item.keys()})
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for item in csv_data:
                writer.writerow(item)
        return True
    except Exception as e:
        logger.error(f"Error saving CSV: {str(e)}", exc_info=True)
        return False

@app.route('/exp1_data', methods=['POST', 'OPTIONS'])
def save_data():
    if request.method == 'OPTIONS':
        return '', 204

    try:
        data = request.get_json()
        logger.debug(f"Received data: {data}")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        prolificId = data.get('prolificId', '')
        completionCode = data.get('completionCode', '')

        filename = f"{prolificId}_{completionCode}.csv"
        filepath = os.path.join(DATA_DIR, filename)
        if save_to_csv(data, filepath):
            backup_filepath = os.path.join(DATA_DIR, f"backup_{filename}")
            save_to_csv(data, backup_filepath)

            return jsonify({
                "status": "success",
                "message": "Data saved successfully",
                "filename": filename
            })
        else:
            return jsonify({
                "status": "error",
                "message": "Failed to save data"
            }), 500

    except Exception as e:
        logger.error(f"Error saving data: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500

###########################################################################
# 3) heartbeat 路由，用于健康检测
###########################################################################
@app.route('/heartbeat', methods=['GET', 'OPTIONS'])
def heartbeat():
    if request.method == 'OPTIONS':
        return '', 204
    return jsonify({"status": "alive"})

###########################################################################
# 启动服务
###########################################################################
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5912, debug=True)
