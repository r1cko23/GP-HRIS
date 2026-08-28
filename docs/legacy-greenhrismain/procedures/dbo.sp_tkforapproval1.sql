
-- =============================================
-- Author:      Pats Relos
-- Create date: 1-04-2026 @ 04:03 PM
-- Description: List of payroll summary for audit
-- =============================================
CREATE PROCEDURE [dbo].[sp_tkforapproval1]
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
		payrollmonth  NVARCHAR(25),
		payrollmonthsort int,
		payrollyear int,
        datalocked NVARCHAR(5),
        forapproval INT DEFAULT 0,
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
    iddepartment,
    departmentdesc,
    date_start,
    date_end,
    payrolldate,
	payrollmonth,
	payrollmonthsort,
	payrollyear,
    forapproval,
	trxtype
)
SELECT
    c.idclient,
    c.companyname,
    tk.departmentcode,
    d.Department_desc,
    tk.datestart,
    tk.dateend,
    tk.payrolldate,
	tk.payrollmonth,
	tk.payrollmonthsort,
	tk.payrollyear,
    COUNT(tk.id) AS totalnoofemployee,
	tk.trxtype

FROM tbl_timekeep AS tk
INNER JOIN [GREENHRISMAIN].dbo.client AS c
    ON tk.idclient = c.idclient
INNER JOIN Department AS d
    ON tk.departmentcode = d.iddepartment
WHERE tkstatus = 'Audited'
and tk.payrollstatus ='Unprocess'




GROUP BY
    c.idclient,
    c.companyname,
    tk.departmentcode,
    d.Department_desc,
    tk.datestart,
    tk.dateend,
    tk.payrolldate,
	tk.payrollmonth,
	tk.payrollmonthsort,
	tk.payrollyear,
	tk.trxtype

----------------END FOR AUDIT---------------------------- 


-----------FOR CORRECTION -------

-- ============================
-- FOR CORRECTION (SET-BASED)
-- ============================

UPDATE t
SET t.pending = fc.forcorrection
FROM #tk3 t
INNER JOIN (
    SELECT
        tk.idclient,
        tk.departmentcode AS iddepartment,
        tk.datestart       AS date_start,
        tk.payrolldate,
        COUNT(tk.id)       AS forcorrection
    FROM tbl_timekeep tk
    WHERE tk.tkstatus = 'Pending'
	
    GROUP BY
        tk.idclient,
        tk.departmentcode,
        tk.datestart,
        tk.payrolldate
) fc
   ON t.idclient     = fc.idclient
   AND t.iddepartment = fc.iddepartment
   AND t.date_start   = fc.date_start
   AND t.payrolldate  = fc.payrolldate;





-------------------- End For Correction   Process-----------------------------------------

								   	  

 -- SHOW LIST 
 SELECT * FROM #tk3
  where companyname LIKE '%' + @keytext + '%'  or departmentdesc LIKE '%' + @keytext + '%'
  order by trxtype asc ,departmentdesc,date_start asc

 delete from #tk3




END



