-- =============================================
-- Author:		<Pat Relos
-- Create date: <1-16-2024>
-- Description:	<SSS Complex>
-- =============================================
CREATE PROCEDURE [dbo].[USP_WTAX]
@payrollmonth nvarchar(30),
@idclient int,
@clientname nvarchar(100),
@departmentcodep int,
@idclientbranchp int

AS	

BEGIN

--constant value for testing 
--DECLARE @idclient int =157
--DECLARE @payrollmonth nvarchar(20) ='November 2023'
--declare @departmentcodep int =213

declare @idclientlast int
declare @departmentcodeplast int
declare @branchcodelast int
declare @idclientbranchlast int
declare @idemployeesss int



SET NOCOUNT ON;
 

CREATE TABLE #TempTableWTAX(
    [ID] INT IDENTITY(1, 1) PRIMARY KEY,
    [idpayrollsum] int,
	[Employee_id] int,
	[lname] NVARCHAR(50),
	[fname] NVARCHAR(50),
	[mname] NVARCHAR(50),
	[idclient] int,
	[idclientp] int,
	[monthyear] NVARCHAR(20),
	[departmentcodep] int, 
	[idclientbranchp] int, 
	[grossamttaxable] float, 
	[WTAX] FLOAT,
	[TINNO] NVARCHAR(30)	
   );

-- Insert data from the payroll_summary table into the #TempTable
CREATE INDEX idx_empid ON #TempTableWTAX (Employee_id);
CREATE INDEX idx_idpayrollsum ON #TempTableWTAX (idpayrollsum);
CREATE INDEX idx_monthyear ON #TempTableWTAX (monthyear);
CREATE INDEX idx_lname ON #TempTableWTAX (lname);
CREATE INDEX idx_clientp ON #TempTableWTAX (idclientp);


INSERT INTO #TempTableWTAX (employee_id,idpayrollsum,lname,fname,mname,idclient,idclientp,idclientbranchp,monthyear,departmentcodep,grossamttaxable,WTAX,TINNO)
		
SELECT        employee_id, idpayrollsum, lname, fname,  mname,idclient,idclientp,idclientbranchp, payrollmonth,department_codep,grossamttaxable,WTAX,TINNO
FROM          forwtax
where payrollmonth = @payrollmonth
order by lname,fname


---SET get last idclient 
DECLARE myCursor2 CURSOR FOR

	SELECT employee_id FROM #TempTableWTAX where monthyear=@payrollmonth and idclientp <> @idclient
	OPEN myCursor2
   
   FETCH NEXT FROM myCursor2 INTO @idemployeesss
	WHILE @@FETCH_STATUS = 0
	
	BEGIN
		--get last idclientp and department
		 SELECT TOP 1  @idclientlast =  idclientp FROM #TempTableWTAX where Employee_id = @idemployeesss and monthyear = @payrollmonth order by idpayrollsum desc
		 SELECT TOP 1  @departmentcodeplast =  departmentcodep FROM #TempTableWTAX where Employee_id = @idemployeesss and monthyear = @payrollmonth order by idpayrollsum desc
		 SELECT TOP 1  @idclientbranchlast =  idclientbranchp FROM #TempTableWTAX where Employee_id = @idemployeesss and monthyear = @payrollmonth order by idpayrollsum desc


		--update 
		update #TempTableWTAX
		set idclientp = @idclientlast,
		departmentcodep = @departmentcodeplast,
		idclientbranchp = @idclientbranchlast		
		Where Employee_id = @idemployeesss 


		FETCH NEXT FROM myCursor2 INTO @idemployeesss
	END
	CLOSE myCursor2
	DEALLOCATE myCursor2    
	   	 
-- Retrieve data from #TempTable

SELECT      sum(#TempTableWTAX.WTAX) as WTAXEE, 
			sum(#TempTableWTAX.grossamttaxable) as grosstaxableamt,
			#TempTableWTAX.Employee_id,#TempTableWTAX.fname,#TempTableWTAX.lname,#TempTableWTAX.mname,#TempTableWTAX.monthyear,#TempTableWTAX.idclient,#TempTableWTAX.departmentcodep,#TempTableWTAX.monthyear,companyname, Department.Department_desc,client_branch.branch,#TempTableWTAX.TINNO
FROM            #TempTableWTAX 
                         INNER JOIN client ON #TempTableWTAX.idclientp = client.idclient
						 INNER JOIN Department ON #TempTableWTAX.departmentcodep = Department.iddepartment
						 INNER JOIN client_branch ON #TempTableWTAX.idclientbranchp = client_branch.idclientbranch						 
						 where  (@idclient = 0 OR idclientp = @idclient)
						 AND (@departmentcodep IS NULL OR departmentcodep = @departmentcodep OR @departmentcodep = 0)
						 AND (@idclientbranchp IS NULL OR idclientbranchp = @idclientbranchp OR @idclientbranchp = 0)
						 
			group by #TempTableWTAX.Employee_id, #TempTableWTAX.fname,#TempTableWTAX.lname,#TempTableWTAX.mname,#TempTableWTAX.monthyear,#TempTableWTAX.idclient,#TempTableWTAX.departmentcodep,#TempTableWTAX.monthyear,companyname,Department.Department_desc,client_branch.branch,#TempTableWTAX.TINNO
			HAVING (sum(#TempTableWTAX.WTAX) <> 0)
			order by lname,fname asc;
			
-- Remember to drop the temporary table when you no longer need it
DROP TABLE #TempTableWTAX;


END

