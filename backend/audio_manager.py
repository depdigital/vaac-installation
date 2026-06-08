from pathlib import Path

ASSET_DIR = (
    Path(__file__).resolve().parent.parent
    / "assets"
)

ACTIVE_POOL = "pool1"

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

    ACTIVE_POOL = pool_name

def get_active_pool():

    return ACTIVE_POOL