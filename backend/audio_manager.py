from pathlib import Path

ASSET_DIR = (
    Path(__file__).resolve().parent.parent
    / "assets"
)

ACTIVE_POOL = "pool1"

import json

DATA_DIR = (
    Path(__file__).resolve().parent.parent
    / "data"
)

DATA_DIR.mkdir(
    exist_ok=True
)

POOL_FILE = (
    DATA_DIR
    / "active_pool.json"
)

def get_audio_assets():

    assets = []

    pool_dir = (
    ASSET_DIR /
    ACTIVE_POOL
)

    for f in sorted(
        pool_dir.glob("*.wav")
    ):

        assets.append(
            {
                "name": f.name,

                "size_mb":
                    round(
                        f.stat().st_size
                        / (1024 * 1024),
                        2
                    )
            }
        )

    return assets

def get_audio_summary():

    assets = get_audio_assets()

    total_mb = round(
        sum(
            asset["size_mb"]
            for asset in assets
        ),
        2
    )

    return {

        "count": len(assets),

        "total_mb": total_mb,

        "assets": assets
    }

def get_pools():

    pools = []

    for item in sorted(
        ASSET_DIR.iterdir()
    ):
        if item.is_dir():

            pools.append(
                item.name
            )

    return pools

def set_active_pool(pool_name):

    global ACTIVE_POOL

    if pool_name not in get_pools():

        raise ValueError(
            f"Pool not found: {pool_name}"
        )

    ACTIVE_POOL = pool_name

    save_active_pool()

def load_active_pool():

    global ACTIVE_POOL

    try:

        with open(
            POOL_FILE,
            "r"
        ) as f:

            data = json.load(f)

        ACTIVE_POOL = (
            data.get(
                "pool",
                "pool1"
            )
        )

        print(
            "Active pool restored:",
            ACTIVE_POOL
        )

    except FileNotFoundError:

        print(
            "No saved pool found"
        )

    except Exception as e:

        print(
            "Pool restore error:",
            e
        )

def get_active_pool():

    return ACTIVE_POOL

def save_active_pool():

    with open(
        POOL_FILE,
        "w"
    ) as f:

        json.dump(
            {
                "pool":
                ACTIVE_POOL
            },
            f,
            indent=4
        )

load_active_pool()