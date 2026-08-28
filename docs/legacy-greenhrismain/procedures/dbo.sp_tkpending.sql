
-- =============================================
-- Author:      Pats Relos
-- Create date: 1-04-2026 @ 04:03 PM
-- Description: List of payroll summary for audit
-- =============================================
CREATE PROCEDURE [dbo].[sp_tkpending]
--    @keytext VARCHAR(50)

AS
BEGIN
    SET NOCOUNT ON;

    CREATE TABLE #tk3
    (
        IDtk INT IDENTITY(1,1) PRIMARY KEY,
		Id INT,
		employeeid int,
		fullname nvarchar(150),
        idclient INT,
        companyname NVARCHAR(150),
		iddepartment INT,
        departmentdesc NVARCHAR(100),
        idbranch INT,
        branch NVARCHAR(100),
        date_start DATE,
        date_end DATE,
        payrolldate DATE,
		payrollmonth NVARCHAR(100),	   
		payrollmonthsort int,
        datalocked NVARCHAR(5),
        foraudit INT DEFAULT 0,
		forcorrection INT DEFAULT 0,         
        remainingnoofemployee INT DEFAULT 0,
        awaitingtag INT, 
		trxtype NVARCHAR(30),
		frequencypayment NVARCHAR(30)
    );

    CREATE INDEX idx_tk3_idclient ON #tk3 (idclient);
--FOR AUDIT
    INSERT INTO #tk3
(
	Id,
	employeeid,
	fullname,
    idclient,
    companyname,
    iddepartment,
    departmentdesc,
	idbranch,
    date_start,
    date_end,
    payrolldate,
	payrollmonth,
	payrollmonthsort,
	trxtype,
	frequencypayment
)
SELECT
	tk.id,	
	tk.employeeid,
	tk.lname2 + ' '+ fname2 as empname,
    c.idclient,
    c.companyname,
    tk.departmentcode,
    d.Department_desc,
	tk.idclientbranch,
    tk.datestart,
    tk.dateend,
    tk.payrolldate,
	tk.payrollmonth,
	tk.payrollmonthsort,
	tk.trxtype,
	tk.frequencypaymenttk

FROM tbl_timekeep AS tk
INNER JOIN client AS c
    ON tk.idclient = c.idclient
INNER JOIN Department AS d
    ON tk.departmentcode = d.iddepartment
WHERE tkstatus = 'Pending'	   			


----------------END FOR CORRECTION---------------------------- 
																	 																	 

 -- SHOW LIST 
 SELECT * FROM #tk3	 
 --where companyname LIKE '%' + @keytext + '%'  or departmentdesc LIKE '%' + @keytext + '%'

 delete from #tk3

END
