from pathlib import Path

ASSET_DIR = (
    Path(__file__).resolve().parent.parent
    / "assets"
)

def get_audio_assets():

    assets = []

    for f in sorted(
        ASSET_DIR.glob("*.wav")
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