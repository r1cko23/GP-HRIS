-- =============================================
-- Author:		Pats Relos
-- Create date: <03-03-2024>
-- Description:	<Thirteenmontn Monthly Report>
-- =============================================
CREATE PROCEDURE [dbo].[usp_SILmonhtlyreport]
@yearx nvarchar(20)

AS	

BEGIN

--DECLARE @yearx nvarchar(20) = '2023'
--DECLARE @idclientx int =105
--DECLARE @payoutdate nvarchar(20) ='2023-10-15'


	SET NOCOUNT ON;
update  payroll_summary
set silp = noofdayswork / 313 * 5 * dailyrate_payroll
where payroll_summary.payrolldate >= '2024-01-01'


CREATE TABLE #TempTableSILmonthly (
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
	[columnsort] int,
	[idclient] int,
    [Companyname] NVARCHAR(100),
	[departmentcode] int,
	[amount] float,
	[payrollmonth] NVARCHAR(100),
	[monthsort] int
	
	   
);


-- Insert data from the payroll_summary table into the #TempTable
CREATE INDEX idx_companyname ON #TempTableSILmonthly (Companyname);


INSERT INTO #TempTableSILmonthly (idclient, Companyname,departmentcode,amount,payrollmonth,monthsort)
				
SELECT      payroll_summary.idclientp,client.companyname,payroll_summary.department_codep, SUM(payroll_summary.silp) AS amt, FORMAT(payroll_summary.payrolldate, 'MMMM yyyy') AS formatted_date, FORMAT(payroll_summary.payrolldate, 'yyyMM') AS monthsort
FROM         payroll_summary INNER JOIN
                      client ON payroll_summary.idclientp = client.idclient
WHERE     (payroll_summary.payrolldate >= '2024-01-01') and (payroll_summary.idclientp <> 46)
GROUP BY payroll_summary.idclientp, client.companyname, department_codep, FORMAT(payroll_summary.payrolldate, 'MMMM yyyy'),FORMAT(payroll_summary.payrolldate, 'yyyMM') 

 

INSERT INTO #TempTableSILmonthly (idclient, Companyname,departmentcode,amount,payrollmonth,monthsort)
				
SELECT      100+''+department_codep as idclient2,departmentdesc2,payroll_summary.department_codep, SUM(payroll_summary.silp) AS amt, FORMAT(payroll_summary.payrolldate, 'MMMM yyyy') AS formatted_date, FORMAT(payroll_summary.payrolldate, 'yyyMM') AS monthsort
FROM         payroll_summary INNER JOIN
                      client ON payroll_summary.idclientp = client.idclient
WHERE     (payroll_summary.payrolldate >= '2024-01-01') and (payroll_summary.department_codep = 26 or payroll_summary.department_codep = 25 )
GROUP BY departmentdesc2, client.companyname, department_codep, FORMAT(payroll_summary.payrolldate, 'MMMM yyyy'),FORMAT(payroll_summary.payrolldate, 'yyyMM') 




-- Retrieve data from #TempTable
SELECT * FROM #TempTableSILmonthly  order by Companyname;


-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTableSILmonthly;

END

