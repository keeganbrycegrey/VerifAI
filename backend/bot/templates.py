# messenger message templates
# bilingual - tagalog first, english fallback


def welcome_message() -> str:
    return (
        "Kamusta! Ako si VerifAI \u2014 ang inyong AI fact-checker para sa mga balitang Pilipino.\n\n"
        "Magpadala ng:\n"
        "\u2022 Teksto o headline na gusto ninyong i-check\n"
        "\u2022 Larawan ng screenshot o meme\n"
        "\u2022 Link ng artikulo\n\n"
        "Susuriin ko ito at magbibigay ng hatol kaagad."
    )


def error_message() -> str:
    return (
        "Paumanhin, may nangyaring error sa pag-check. Subukan muli.\n"
        "(Sorry, something went wrong. Please try again.)"
    )


def unsupported_message() -> str:
    return (
        "Pasensya na, tanggap lamang ang teksto, larawan, o link ngayon.\n"
        "(Only text, images, or links are supported right now.)"
    )


def typing_indicator_text() -> str:
    return "Sinusuri... sandali lang."