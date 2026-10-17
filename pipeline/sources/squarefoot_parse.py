"""Parsers for Squarefoot (squarefoot.com.hk) pages.

The crawler stores raw HTML; this module converts it into plain dictionaries.
Keeping parsing separate from fetching makes it cheap to re-parse the cache
when the markup changes, and makes every field testable with fixtures.

Public contract (see docs/DATA_DICTIONARY.md):
    parse_listing(html, url)     -> listing dict
    parse_estate(html, url)      -> estate dict
    parse_index(html, url)       -> index-page dict
    parse_transactions(html, url)-> list[transaction dict]
"""

from __future__ import annotations

import json
import re
from datetime import date
from typing import Any
from urllib.parse import urlparse

from bs4 import BeautifulSoup

REGIONS = ("HK Island", "Kowloon", "New Territories", "Outlying Islands")
FLOOR_ZONES = {
    "ground floor": 0,
    "low floor": 1,
    "lower floor": 1,
    "middle floor": 2,
    "mid floor": 2,
    "high floor": 3,
    "upper floor": 3,
    "top floor": 4,
}


def _text(node: Any) -> str:
    if node is None:
        return ""
    if isinstance(node, str):
        return re.sub(r"\s+", " ", node).strip()
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()


def _number(value: str) -> float | None:
    if value is None:
        return None
    cleaned = value.replace(",", "").strip()
    if not cleaned or cleaned in {"-", "--", "N/A", "n/a"}:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_money(value: str) -> float | None:
    """Parse HKD price/rent strings, including Millions/M and Billions/B."""
    if not value:
        return None
    match = re.search(
        r"(?:HKD|HK\$|\$)\s*([\d,]+(?:\.\d+)?)\s*(Millions?|M|Billions?|B)?",
        value,
        flags=re.I,
    )
    if not match:
        return None
    number = _number(match.group(1))
    if number is None:
        return None
    suffix = (match.group(2) or "").lower()
    if suffix.startswith("m"):
        return round(number * 1_000_000, 2)
    if suffix.startswith("b"):
        return round(number * 1_000_000_000, 2)
    return number


def parse_area(value: str) -> tuple[float | None, float | None, bool]:
    """Return (area_sqft, unit_price_psf, is_gross)."""
    if not value:
        return None, None, False
    match = re.search(r"([\d,]+(?:\.\d+)?)\s*ft", value, flags=re.I)
    area = _number(match.group(1)) if match else None
    psf_match = re.search(r"@\s*([\d,]+(?:\.\d+)?)", value)
    psf = _number(psf_match.group(1)) if psf_match else None
    return area, psf, "(Gross)" in value


def parse_int(value: str) -> int | None:
    number = _number(value)
    return int(number) if number is not None else None


def parse_rooms(value: str) -> tuple[int | None, int | None]:
    """Return (bedrooms, bathrooms); studio is 0 bedrooms."""
    if not value:
        return None, None
    beds: int | None = None
    if re.search(r"\bstudio\b", value, flags=re.I):
        beds = 0
    else:
        match = re.search(r"(\d+)\s*Bedrooms?", value, flags=re.I)
        if match:
            beds = int(match.group(1))
    bath = re.search(r"(\d+)\s*Bathrooms?", value, flags=re.I)
    return beds, int(bath.group(1)) if bath else None


def parse_floor(value: str) -> tuple[str | None, int | None]:
    if not value:
        return None, None
    match = re.search(
        r"(Ground|Low|Lower|Middle|Mid|High|Upper|Top)\s*Floor", value, flags=re.I
    )
    if not match:
        return value.strip() or None, None
    label = f"{match.group(1).title()} Floor"
    return label, FLOOR_ZONES.get(label.lower())


def parse_school_nets(primary: str, secondary: str) -> dict[str, Any]:
    pri_match = re.search(r"School Net\s*(\d+)\s*\(([^)]+)\)", primary or "", flags=re.I)
    sec_match = re.search(r"([^()]+?)\s*\(([A-Z]{1,3}\d+)\)", secondary or "")
    return {
        "school_net_pri": pri_match.group(1) if pri_match else None,
        "school_net_pri_name": pri_match.group(2).strip() if pri_match else None,
        "school_net_sec": sec_match.group(2) if sec_match else None,
        "school_net_sec_name": sec_match.group(1).strip() if sec_match else None,
    }


def parse_estate_cell(value: str, cell: Any = None) -> dict[str, Any]:
    """Parse the 'Estate' table row: name, region, sub-district, age, unit."""
    estate_name = None
    estate_url = None
    estate_id = None
    estate_info: dict[str, str] = {}
    if cell is not None:
        pair_value = cell.select_one("div.pairValue")
        if pair_value:
            estate_name = _text(pair_value)
        link = cell.find("a", href=re.compile(r"/en/estate/detail/"))
        if link:
            estate_url = link.get("href")
            id_match = re.search(r"-(\d+)(?:$|[?#])", estate_url or "")
            estate_id = id_match.group(1) if id_match else None
        hidden = cell.select_one("div.estateInfo")
        if hidden:
            for row in hidden.select("tr"):
                info_cells = row.find_all("td", recursive=False)
                if len(info_cells) >= 2:
                    estate_info[_text(info_cells[0])] = _text(info_cells[1])

    text = re.sub(r"\s+", " ", value or "").strip()
    region = next((r for r in REGIONS if f" {r} " in f" {text} "), None)
    subdistrict = None
    if region:
        before, _, after = text.partition(region)
        if not estate_name or "See estate's" in estate_name:
            estate_name = before.strip() or None
        subdistrict = re.split(r"Block and Unit:|Building age:|See estate's", after)[0].strip()
        subdistrict = subdistrict or None

    age_match = re.search(r"Building age:\s*([\d.]+)\s*Year", text, flags=re.I)
    unit_match = re.search(r"Block and Unit:\s*(.*?)\s*(?:Building age:|See estate's|$)", text)
    return {
        "estate_name": estate_name,
        "estate_url": estate_url,
        "estate_id": estate_id,
        "region_label": region,
        "subdistrict_label": subdistrict,
        "building_age_years": _number(age_match.group(1)) if age_match else None,
        "block_unit": unit_match.group(1).strip() if unit_match else None,
        "estate_entry_year": estate_info.get("Estate Entry Date"),
        "estate_intro": estate_info.get("Estate Introudction") or estate_info.get("Estate Introduction"),
        "unit_desc": estate_info.get("Unit Desc"),
        "block_desc": estate_info.get("Block Desc"),
    }


def _table_pairs(soup: BeautifulSoup) -> dict[str, str]:
    pairs: dict[str, str] = {}
    for row in soup.select("table.tablePair tr"):
        cells = row.find_all("td", recursive=False)
        if len(cells) < 2:
            continue
        label = _text(cells[0])
        if not label:
            continue
        pairs[label] = _text(cells[1])
    return pairs


def _json_ld(soup: BeautifulSoup) -> list[Any]:
    records: list[Any] = []
    for script in soup.find_all("script", {"type": "application/ld+json"}):
        raw = script.string or script.get_text()
        if not raw:
            continue
        try:
            records.append(json.loads(raw))
        except json.JSONDecodeError:
            continue
    return records


def parse_listing(html: str, url: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    pairs = _table_pairs(soup)
    title = _text(soup.find("title"))
    page_text = _text(soup.body or soup)

    created = updated = None
    date_node = soup.select_one("div.propertyDate")
    if date_node:
        date_text = _text(date_node)
        created_match = re.search(r"Created:\s*(\d{4}-\d{2}-\d{2})", date_text)
        updated_match = re.search(r"Updated:\s*(\d{4}-\d{2}-\d{2})", date_text)
        created = created_match.group(1) if created_match else None
        updated = updated_match.group(1) if updated_match else None
    if not created:
        created_match = re.search(r"Created:\s*(\d{4}-\d{2}-\d{2})", page_text)
        created = created_match.group(1) if created_match else None
    if not updated:
        updated_match = re.search(r"Updated:\s*(\d{4}-\d{2}-\d{2})", page_text)
        updated = updated_match.group(1) if updated_match else None

    id_match = re.search(r"Id#\s*(\d+)", page_text)
    listing_id = id_match.group(1) if id_match else None
    if not listing_id:
        url_match = re.search(r"/property-(\d+)", url)
        listing_id = url_match.group(1) if url_match else None

    listing_type = "rent" if "/rent/" in url else "sale"
    building_type = None
    path_parts = [part for part in urlparse(url).path.split("/") if part]
    if len(path_parts) >= 3 and path_parts[0] == "en":
        building_type = path_parts[2].replace("-", " ")

    price_label = "Monthly Rental" if listing_type == "rent" else "Sell Price"
    price = parse_money(pairs.get(price_label, ""))
    gross_area, gross_psf, _ = parse_area(pairs.get("Gross Area", ""))
    saleable_area, saleable_psf, _ = parse_area(pairs.get("Saleable Area", ""))
    area = saleable_area or gross_area
    price_psf = saleable_psf
    if price_psf is None and price is not None and area:
        price_psf = round(price / area, 2)

    bedrooms, bathrooms = parse_rooms(pairs.get("Room and Bathroom", ""))
    floor_label, floor_ordinal = parse_floor(pairs.get("Floor zone", ""))
    estate_cell = None
    for row in soup.select("table.tablePair tr"):
        label_cell = row.find("td", class_="table_left")
        if label_cell and _text(label_cell) == "Estate":
            estate_cell = row.find("td", class_="table_right")
            break
    estate = parse_estate_cell(pairs.get("Estate", ""), cell=estate_cell) if pairs.get("Estate") else {}

    # The estate cell link is the most reliable source for name/id.
    if not estate.get("estate_name"):
        link = soup.find("a", href=re.compile(r"/en/estate/detail/"))
        if link:
            estate["estate_name"] = _text(link)
            estate["estate_url"] = link.get("href")
            id_match = re.search(r"-(\d+)(?:$|[?#])", estate.get("estate_url") or "")
            estate["estate_id"] = id_match.group(1) if id_match else None

    coords = re.search(r"initNearbyMap\(([-\d.]+)\s*,\s*([-\d.]+)", html)
    lat = float(coords.group(1)) if coords else None
    lon = float(coords.group(2)) if coords else None

    district_from_title = None
    title_match = re.search(r"\|\s*([^|]+?)\s*\|\s*Squarefoot", title or "")
    if title_match:
        district_from_title = title_match.group(1).strip()

    return {
        "source": "squarefoot",
        "url": url,
        "listing_id": listing_id,
        "listing_type": listing_type,
        "building_type": building_type,
        "title": title,
        "price": price,
        "price_psf": round(price_psf, 2) if price_psf else None,
        "gross_area_sqft": gross_area,
        "saleable_area_sqft": saleable_area,
        "area_sqft": area,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "floor_zone": floor_label,
        "floor_ordinal": floor_ordinal,
        "building_age_years": estate.get("building_age_years"),
        "block_unit": estate.get("block_unit"),
        "estate_name": estate.get("estate_name"),
        "estate_id": estate.get("estate_id"),
        "estate_url": estate.get("estate_url"),
        "region_label": estate.get("region_label"),
        "subdistrict_label": estate.get("subdistrict_label") or district_from_title,
        "estate_entry_year": estate.get("estate_entry_year"),
        "estate_intro": estate.get("estate_intro"),
        "mtr_walk_minutes": (
            int(match.group(1))
            if (match := re.search(r"about\s+(\d+)\s*min\w*\s+walking distance to MTR", estate.get("estate_intro") or "", flags=re.I))
            else None
        ),
        "unit_desc": estate.get("unit_desc"),
        "block_desc": estate.get("block_desc"),
        "address": pairs.get("Address"),
        "school_nets": parse_school_nets(
            pairs.get("Pri School Net", ""), pairs.get("Sec School Net", "")
        ),
        "rent_includes": pairs.get("Rental Price includes"),
        "lat": lat,
        "lon": lon,
        "created_date": created,
        "updated_date": updated,
        "posted_label": (
            match.group(1)
            if (
                match := re.search(
                    r"(\d+\s+(?:hours?|days?|weeks?|months?)\s+ago\s+posted)",
                    page_text,
                    flags=re.I,
                )
            )
            else None
        ),
        "raw_fields": pairs,
    }


def _parse_chart(html: str, soup: BeautifulSoup) -> dict[str, Any]:
    id_match = re.search(r"labels_estate_deal_q_(\d+)", html)
    if not id_match:
        return {"quarters": [], "series": {}}
    chart_id = id_match.group(1)
    quarters = re.findall(rf"labels_estate_deal_q_{chart_id}\.push\('([^']+)'\)", html)
    start = html.find(f"const data_estate_deal_q_{chart_id}")
    block = html[start:] if start >= 0 else ""
    labels = re.findall(r"label:\s*'([^']+)'", block)
    arrays = re.findall(r"data:\s*\[([^\]]*)\]", block, flags=re.S)
    series: dict[str, list[float]] = {}
    for label, raw_array in zip(labels, arrays):
        values = [float(value) for value in re.findall(r"-?\d+(?:\.\d+)?", raw_array)]
        if label in {"AVG Price", "All HK", "Volume"} and len(values) == len(quarters):
            series[label] = values
    if "AVG Price" not in series:
        series = {}
    return {"quarters": quarters, "series": series}


def _section(page_text: str, start: str, end: str) -> str:
    begin = page_text.find(start)
    if begin < 0:
        return ""
    finish = page_text.find(end, begin + len(start))
    return page_text[begin : finish if finish >= 0 else begin + 6000]


def parse_estate(html: str, url: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    page_text = _text(soup.body or soup)
    title = _text(soup.find("title"))

    entity: dict[str, Any] = {}
    for record in _json_ld(soup):
        if isinstance(record, dict) and record.get("@type") == "ItemPage":
            entity = record.get("mainEntity") or {}
            break

    description = _text(entity.get("description"))
    address = entity.get("address") or {}
    if not isinstance(address, dict):
        address = {}

    units = entity.get("numberOfAccommodationUnits")
    if isinstance(units, dict):
        units = units.get("value")
    units = parse_int(str(units)) if units is not None else None

    additional = {}
    for prop in entity.get("additionalProperty") or []:
        if isinstance(prop, dict) and prop.get("name"):
            additional[prop["name"]] = prop.get("value")

    occupation = re.search(r"Occupation date starts from\s+([A-Za-z]+ \d{4})", description, flags=re.I)
    total_units = re.search(r"total of\s+([\d,]+)\s+residential units", description, flags=re.I)
    school_net = re.search(r"POA School Net is\s+(\d+)", description, flags=re.I)
    mtr_minutes = re.search(r"about\s+(\d+)\s*min walking distance to MTR", description, flags=re.I)
    developer = re.search(r"The developer is\s+([^,.]+)", description, flags=re.I)

    breadcrumb = [_text(node) for node in soup.select("ol.breadcrumb a span[itemprop='name']")]
    if not breadcrumb:
        breadcrumb = [_text(node) for node in soup.select("div.c_breadcrumb a")]

    coords = re.search(r"initNearbyMap\(([-\d.]+)\s*,\s*([-\d.]+)", html)
    lat = float(coords.group(1)) if coords else None
    lon = float(coords.group(2)) if coords else None

    chart = _parse_chart(html, soup)
    sale_text = _section(page_text, "Latest Property Price Trend", "Latest Rental Market")
    rent_text = _section(page_text, "Latest Rental Market", "Sold Price Trend")

    def first_number(pattern: str, text: str) -> float | None:
        match = re.search(pattern, text, flags=re.I)
        return _number(match.group(1)) if match else None

    sale_stats = {
        "avg_price_psf": first_number(r"Avg\.\s*price per sqft\s*HKD?\$?\s*([\d,]+(?:\.\d+)?)", sale_text),
        "volume": first_number(r"Volume\s+([\d,]+)\s+cases", sale_text),
        "profit_ratio": first_number(r"Profit Ratio\s+([\d.]+)%", sale_text),
        "loss_ratio": first_number(r"Loss Ratio\s+([\d.]+)%", sale_text),
        "turnover_rate": first_number(r"Year Turnover Rate\s+([\d.]+)%", sale_text),
        "price_1y_ago": first_number(r"Price 1 yr ago\s+HKD?\$?\s*([\d,]+(?:\.\d+)?)", sale_text),
        "listing_count": first_number(r"([\d,]+)\s*units For Sale", sale_text),
    }
    rent_stats = {
        "avg_rent_psf": first_number(r"Avg\.\s*rent\s*\$?\s*([\d.]+)", rent_text),
        "volume": first_number(r"Volume\s+([\d,]+)\s+cases", rent_text),
        "yield_pct": first_number(r"Rental Yield\s*~?\s*([\d.]+)%", rent_text),
        "activity_pct": first_number(r"Rental activity\s+([\d.]+)%", rent_text),
        "listing_count": first_number(r"([\d,]+)\s*units Rental", rent_text),
    }
    price_range = re.search(r"Rental Price\s+HKD\$([\d,]+)\s*-\s*HKD\$([\d,]+)", rent_text)
    if price_range:
        rent_stats["rent_min"] = parse_money(price_range.group(1))
        rent_stats["rent_max"] = parse_money(price_range.group(2))

    # Breadcrumb is Home / Estate / Region / Sub-district / Estate.
    region_label = next((part for part in breadcrumb if part in REGIONS), None)
    subdistrict = None
    if region_label and region_label in breadcrumb:
        index = breadcrumb.index(region_label)
        if index + 1 < len(breadcrumb):
            subdistrict = breadcrumb[index + 1]

    estate_id = None
    id_match = re.search(r"/estate/detail/[^/]*?-(\d+)(?:/|$)", url)
    if id_match:
        estate_id = id_match.group(1)

    return {
        "source": "squarefoot",
        "url": url,
        "estate_id": estate_id,
        "name": title.split(" Price Trend")[0].strip() or _text(entity.get("name")),
        "name_zh": entity.get("alternateName"),
        "address": address.get("streetAddress") or address.get("addressLocality"),
        "address_locality": address.get("addressLocality"),
        "region_label": region_label or address.get("addressRegion"),
        "subdistrict_label": subdistrict,
        "description": description,
        "developer": developer.group(1).strip() if developer else None,
        "completion_label": occupation.group(1) if occupation else None,
        "total_units": (parse_int(total_units.group(1)) if total_units else None) or units,
        "school_net_pri": school_net.group(1) if school_net else None,
        "mtr_walk_minutes": int(mtr_minutes.group(1)) if mtr_minutes else None,
        "lat": lat,
        "lon": lon,
        "additional_property": additional,
        "breadcrumb": breadcrumb,
        "chart": chart,
        "sale_stats": sale_stats,
        "rent_stats": rent_stats,
        "listing_counts": {
            "sale": sale_stats.get("listing_count"),
            "rent": rent_stats.get("listing_count"),
        },
    }


def parse_index(html: str, url: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "lxml")
    item_list = None
    for record in _json_ld(soup):
        if isinstance(record, dict) and record.get("@type") == "ItemList":
            item_list = record
            break

    items = []
    if item_list:
        for item in item_list.get("itemListElement") or []:
            if isinstance(item, dict) and item.get("url"):
                items.append(item["url"])

    if not items:
        items = [
            f"https://www.squarefoot.com.hk/en/{kind}/apartment/property-{pid}"
            for kind, pid in re.findall(r"/en/(buy|rent)/apartment/property-(\d+)", html)
        ]

    page_match = re.search(r"/page-(\d+)", url)
    page = int(page_match.group(1)) if page_match else 1
    next_link = soup.find("a", rel="next")
    next_href = next_link.get("href") if next_link else None
    if not next_href:
        candidate = re.search(r'href="([^"]*/page-(\d+))"', html)
        if candidate and int(candidate.group(2)) == page + 1:
            next_href = candidate.group(1)

    breadcrumb = [_text(node) for node in soup.select("ol.breadcrumb a span[itemprop='name']")]
    district_label = breadcrumb[-1] if breadcrumb else None

    return {
        "source": "squarefoot",
        "url": url,
        "page": page,
        "number_of_items": int(item_list["numberOfItems"]) if item_list and str(item_list.get("numberOfItems", "")).isdigit() else None,
        "items": items,
        "district_label": district_label,
        "has_next": bool(next_href),
        "next_url": next_href,
    }


def parse_transactions(html: str, url: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    tx_type = "lease" if "/rent" in url else "sale"
    rows: list[dict[str, Any]] = []
    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = row.find_all("td", recursive=False)
            if len(cells) < 3:
                continue
            texts = [_text(cell) for cell in cells]
            joined = " ".join(texts)
            date_match = re.search(r"(20\d{2}-\d{2}-\d{2})", joined)
            if not date_match:
                continue
            price = None
            psf = None
            area = None
            for text in texts:
                if price is None and ("HKD" in text or "$" in text):
                    price = parse_money(text)
                area_value, psf_value, _ = parse_area(text)
                if area_value is not None:
                    area = area_value
                if psf_value is not None:
                    psf = psf_value
            if price is None:
                continue
            rows.append(
                {
                    "source": "squarefoot",
                    "tx_type": tx_type,
                    "date": date_match.group(1),
                    "address": texts[0],
                    "area_sqft": area,
                    "price": price,
                    "price_psf": psf,
                    "profit_loss": next(
                        (
                            text
                            for text in texts
                            if re.search(r"^[+-]?\s*[\d.]+%$", text)
                        ),
                        None,
                    ),
                    "row_text": joined,
                }
            )
    return rows


def parse_page(html: str, url: str) -> dict[str, Any]:
    """Dispatch by URL shape."""
    if re.search(r"/property-\d+", url):
        return parse_listing(html, url)
    if "/estate/detail/" in url and "/transaction" in url:
        return {"source": "squarefoot", "url": url, "transactions": parse_transactions(html, url)}
    if "/estate/detail/" in url:
        return parse_estate(html, url)
    if re.search(r"/(buy|rent)/(a\d+|dg\d+)", url):
        return parse_index(html, url)
    return {"source": "squarefoot", "url": url}


def today() -> str:
    return date.today().isoformat()
