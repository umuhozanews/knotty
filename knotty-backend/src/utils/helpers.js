function paginate(query, page = 1, limit = 20) {
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);
  return { skip, take };
}

function paginatedResponse(data, total, page, limit) {
  return {
    data,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit)),
    },
  };
}

function formatRWF(amount) {
  return `${amount.toLocaleString()} RWF`;
}

module.exports = { paginate, paginatedResponse, formatRWF };
