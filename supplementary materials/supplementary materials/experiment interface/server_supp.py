from flask import Flask, request, jsonify
import json
from datetime import datetime
import os
import csv
from flask_cors import CORS
import logging
import threading

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
# 读取 CSV 文件并将每行解析为一个包含 colormap、currentOffsets、exp_distance 的字典
###########################################################################
def load_fixed_assignment_from_csv(csv_filepath):
    """
    从 CSV 文件中读取固定的分配列表，每一行作为一个 dict:
    {
        "colormap": <str>,
        "currentOffsets": <str>,
        "exp_distance": <str>
    }
    如果需要把数值字段转为 float，可在此处做转换。
    """
    fixed_assignments = []
    try:
        with open(csv_filepath, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)  # 依赖 CSV 文件首行为 colormap,currentOffsets,exp_distance
            for row in reader:
                if row:
                    # 如果需要把 currentOffsets / exp_distance 转成 float，可在此处做转换:
                    # row["currentOffsets"] = float(row["currentOffsets"])
                    # row["exp_distance"] = float(row["exp_distance"])
                    fixed_assignments.append(row)
        return fixed_assignments
    except Exception as e:
        logger.error(f"Error loading fixed assignment from CSV: {e}", exc_info=True)
        return []

###########################################################################
# 全局变量，用来存储对于每个 subjectid 分配到的 colormap 列表
###########################################################################
ASSIGNMENTS = [None] * 31  # 被试编号 0~29

def generate_assignments():
    """
    每个被试都获得来自 CSV 文件中的相同分配（列表），
    如果 CSV 文件读取失败，则使用默认固定分配。
    """
    csv_filepath = os.path.join(DATA_DIR, "error_records_dynamic.csv")
    fixed_assignment = load_fixed_assignment_from_csv(csv_filepath)
    
    # 如果 CSV 文件读取失败或为空，则给一个默认值
    if not fixed_assignment:
        logger.warning("CSV 文件读取失败或为空，使用默认固定分配")
        fixed_assignment = [
            {
                "colormap": "Hue-7 with Wave-0",
                "currentOffsets": "21.0",
                "exp_distance": "0.2"
            },
            {
                "colormap": "Hue-5 with Wave-3",
                "currentOffsets": "59.57774965",
                "exp_distance": "0.1"
            }
            # ... 可以继续添加更多默认条目 ...
        ]
    
    # 为每个被试分配相同的列表（用 copy() 避免共享同一个列表对象）
    for i in range(30):
        ASSIGNMENTS[i] = fixed_assignment.copy()

# 启动时生成分配表
generate_assignments()

###########################################################################
# 分配记录加载和保存函数，使用 assignments.json 来记录每个 subjectid 的分配情况
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
# 1) 路由 /get_subject_id —— 分配唯一 subjectid (0~29) + 返回对应 colormap 列表
###########################################################################
@app.route('/get_subject_id', methods=['GET'])
def get_subject_id():
    with LOCK:
        assignments_dict = load_assignments_file()
        subject_id = None
        # 遍历 0~30，找到尚未分配的 id
        for i in range(31):
            if str(i) not in assignments_dict:
                subject_id = i
                break

        if subject_id is None:
            return jsonify({
                "status": "error",
                "message": "All 30 IDs have been assigned!"
            }), 400

        # 将分配记录写入字典
        assignments_dict[str(subject_id)] = ASSIGNMENTS[subject_id]
        save_assignments_file(assignments_dict)

        return jsonify({
            "status": "success",
            "subjectid": subject_id,
            "colormaps": ASSIGNMENTS[subject_id]  # 每个被试得到相同的一组列表
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
