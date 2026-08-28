
-- =============================================
-- Author:      Pats Relos
-- Create date: 1-04-2026 @ 04:03 PM
-- Description: List of payroll summary for audit
-- =============================================
CREATE PROCEDURE [dbo].[sp_tkforaudit1]
    @keytext VARCHAR(50)

AS
BEGIN
    SET NOCOUNT ON;

    CREATE TABLE #tk3
    (
        IDtk INT IDENTITY(1,1) PRIMARY KEY,
        idclient INT,
        companyname NVARCHAR(150),
		iddepartment INT,
        departmentdesc NVARCHAR(100),
        idbranch INT,
        branch NVARCHAR(100),
        date_start DATE,
        date_end DATE,
        payrolldate DATE,
        datalocked NVARCHAR(5),
        foraudit INT DEFAULT 0,
		forcorrection INT DEFAULT 0,         
		pending INT DEFAULT 0,
        remainingnoofemployee INT DEFAULT 0,
        awaitingtag INT, 
		trxtype NVARCHAR(30)
    );

    CREATE INDEX idx_tk3_idclient ON #tk3 (idclient);
--FOR AUDIT
    INSERT INTO #tk3
(
    idclient,
    companyname,
	idbranch,
    iddepartment,
    departmentdesc,
    date_start,
    date_end,
    payrolldate,
    foraudit,
	trxtype
)
SELECT
    c.idclient,
    c.companyname,
	tk.idclientbranch,
    tk.departmentcode,
    d.Department_desc,
    tk.datestart,
    tk.dateend,
    tk.payrolldate,
    COUNT(tk.id) AS totalnoofemployee, 
	tk.trxtype

FROM tbl_timekeep AS tk
INNER JOIN client AS c
    ON tk.idclient = c.idclient
INNER JOIN Department AS d
    ON tk.departmentcode = d.iddepartment
WHERE tkstatus = 'For Audit'

GROUP BY
    c.idclient,
    c.companyname,
	tk.idclientbranch,
    tk.departmentcode,
    d.Department_desc,
    tk.datestart,
    tk.dateend,
    tk.payrolldate,
	tk.trxtype
----------------END FOR AUDIT---------------------------- 


-----------FOR CORRECTION -------

-- ============================
-- FOR CORRECTION (SET-BASED)
-- ============================

    INSERT INTO #tk3
(
    idclient,
    companyname,
	idbranch,
    iddepartment,
    departmentdesc,
    date_start,
    date_end,
    payrolldate,
    forcorrection,
	trxtype
)
SELECT
    c.idclient,
    c.companyname,
	tk.idclientbranch,
    tk.departmentcode,
    d.Department_desc,
    tk.datestart,
    tk.dateend,
    tk.payrolldate,
    COUNT(tk.id) AS totalnoofemployee, 
	tk.trxtype

FROM tbl_timekeep AS tk
INNER JOIN client AS c
    ON tk.idclient = c.idclient
INNER JOIN Department AS d
    ON tk.departmentcode = d.iddepartment
WHERE tkstatus = 'For Correction'

GROUP BY
    c.idclient,
    c.companyname,
	tk.idclientbranch,
    tk.departmentcode,
    d.Department_desc,
    tk.datestart,
    tk.dateend,
    tk.payrolldate,
	tk.trxtype
----------------END FOR AUDIT---------------------------- 


-----------Pending -------

-- ============================
-- PENDING (SET-BASED)
-- ============================

    INSERT INTO #tk3
(
    idclient,
    companyname,
	idbranch,
    iddepartment,
    departmentdesc,
    date_start,
    date_end,
    payrolldate,
    pending,
	trxtype
)
SELECT
    c.idclient,
    c.companyname,
	tk.idclientbranch,
    tk.departmentcode,
    d.Department_desc,
    tk.datestart,
    tk.dateend,
    tk.payrolldate,
    COUNT(tk.id) AS totalnoofemployee, 
	tk.trxtype

FROM tbl_timekeep AS tk
INNER JOIN client AS c
    ON tk.idclient = c.idclient
INNER JOIN Department AS d
    ON tk.departmentcode = d.iddepartment
WHERE tkstatus = 'Pending'

GROUP BY
    c.idclient,
    c.companyname,
	tk.idclientbranch,
    tk.departmentcode,
    d.Department_desc,
    tk.datestart,
    tk.dateend,
    tk.payrolldate,
	tk.trxtype
----------------END FOR Pending---------------------------- 





   
	
-------------------- End For Correction   Process-----------------------------------------




---- SHOW LIST 
   SELECT
    idclient,
    companyname,
    idbranch,
    iddepartment,
    departmentdesc,
    date_start,
    date_end,
    payrolldate,
	SUM(foraudit) AS sumforaudit,
	SUM(forcorrection) AS sumforcorrection,
    SUM(pending) AS sumpending,
    trxtype
FROM #tk3
WHERE 
    (
        companyname LIKE '%' + @keytext + '%' 
        OR departmentdesc LIKE '%' + @keytext + '%'
    )
    AND date_start >= '2026-03-01'
    OR (
        date_start < '2026-03-01' AND
        trxtype = 'Adjustment'
    )

GROUP BY
    idclient,
    companyname,
    idbranch,
    iddepartment,
    departmentdesc,
    date_start,
    date_end,
    payrolldate,
    trxtype

ORDER BY trxtype asc,date_start DESC;
delete from #tk3







--SELECT *
--FROM #tk3
--WHERE 
--    (
--        companyname LIKE '%' + @keytext + '%' 
--        OR departmentdesc LIKE '%' + @keytext + '%'
--    )
--    AND date_start >= '2026-03-01'
--    OR (
--        date_start < '2026-03-01' AND
--        trxtype = 'Adjustment'
--    )
--ORDER BY date_start DESC;

delete from #tk3

END
